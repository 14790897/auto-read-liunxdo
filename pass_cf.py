# 参考:https://linux.do/t/topic/817360
#!/usr/bin/python3
from flask import Flask, request, Response, stream_with_context
from curl_cffi import requests
import json
import time
from threading import Thread, Event, Lock
from queue import Queue
from urllib.parse import urlparse
from datetime import datetime, timedelta

app = Flask(__name__)

# Session 管理
class SessionManager:
    def __init__(self, refresh_interval=3600):  # 默认每小时刷新
        self.session = None
        self.last_refresh = None
        self.refresh_interval = refresh_interval
        self.lock = Lock()
        self._create_session()
    
    def _create_session(self):
        """创建新的 session"""
        self.session = requests.Session(impersonate="chrome110")
        self.last_refresh = datetime.now()
        print(f"[{self.last_refresh}] Created new session")
    
    def get_session(self):
        """获取 session，必要时刷新"""
        with self.lock:
            if (datetime.now() - self.last_refresh).total_seconds() > self.refresh_interval:
                print(f"[{datetime.now()}] Session expired, creating new one...")
                self._create_session()
            return self.session

# 创建全局 session 管理器
session_manager = SessionManager(refresh_interval=3600)  # 每小时刷新

# 支持的域名映射
PROXY_DOMAINS = {
    'claude.ai': 'https://claude.ai',
    'www.claude.ai': 'https://claude.ai',
    # 保留原有的Perplexity域名以保持兼容性
    'www.perplexity.ai': 'https://www.perplexity.ai',
    'perplexity.ai': 'https://www.perplexity.ai',
    'api.cloudinary.com': 'https://api.cloudinary.com',
    'ppl-ai-file-upload.s3.amazonaws.com': 'https://ppl-ai-file-upload.s3.amazonaws.com',
    'pplx-res.cloudinary.com': 'https://pplx-res.cloudinary.com'
}

def heartbeat_generator(response_queue, stop_event):
    """生成心跳数据以保持连接活跃"""
    while not stop_event.is_set():
        time.sleep(2)
        response_queue.put(b' ')

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'])
def proxy(path):
    try:
        method = request.method
        headers = dict(request.headers)
        
        original_host = headers.get('Host', 'claude.ai')
        
        # 保留原始Cookie
        cookies = request.cookies
        
        # 删除可能导致问题的头部
        for h in ['Host', 'host', 'X-Real-Ip', 'X-Forwarded-For']:
            headers.pop(h, None)
        
        if original_host in PROXY_DOMAINS:
            base_url = PROXY_DOMAINS[original_host]
        else:
            base_url = 'https://claude.ai'
        
        target_url = f"{base_url}/{path}" if path else base_url
        if request.query_string:
            target_url += f"?{request.query_string.decode('utf-8')}"
        
        target_host = urlparse(base_url).netloc
        headers['Host'] = target_host
        
        # 添加Claude特定的头部
        if 'claude.ai' in target_host:
            headers['Origin'] = 'https://claude.ai'
            headers['Referer'] = 'https://claude.ai/'
            headers['anthropic-client-platform'] = 'web_claude_ai'
        
        print(f"Proxying {method} request from {original_host} to: {target_url}")
        
        # 更精确的SSE判断条件
        is_sse = (
            '/completion' in path and  # 必须是completion端点
            method == 'POST'  # 必须是POST请求
        ) or (
            'perplexity_ask' in path  # 保持原有的perplexity支持
        )
        
        print(f"Is SSE request: {is_sse}")
        
        if is_sse:
            return handle_sse_request(method, target_url, headers, cookies)
        else:
            return handle_normal_request(method, target_url, headers, cookies)
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(f"Error: {str(e)}", status=500)

def handle_normal_request(method, target_url, headers, cookies):
    """处理普通请求"""
    session = session_manager.get_session()
    
    try:
        # 打印请求详情以便调试
        print(f"Request headers: {json.dumps(headers, indent=2)}")
        
        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            raw_data = request.get_data()
            if raw_data:
                # 打印请求体以便调试
                try:
                    print(f"Request body: {json.dumps(json.loads(raw_data), indent=2)}")
                except:
                    print(f"Request body (raw): {raw_data[:200]}...")
                
                resp = session.request(
                    method, 
                    target_url, 
                    data=raw_data, 
                    headers=headers, 
                    cookies=cookies,
                    timeout=30
                )
            else:
                resp = session.request(
                    method, 
                    target_url, 
                    headers=headers, 
                    cookies=cookies,
                    timeout=30
                )
        else:
            resp = session.request(
                method, 
                target_url, 
                headers=headers, 
                cookies=cookies,
                timeout=30
            )
        
        print(f"Response status: {resp.status_code}")
        
        # 打印响应头和内容以便调试
        print(f"Response headers: {json.dumps(dict(resp.headers), indent=2)}")
        try:
            print(f"Response body: {json.dumps(json.loads(resp.text), indent=2)}")
        except:
            print(f"Response body (raw): {resp.text[:200]}...")
        
        response_headers = {}
        for key, value in resp.headers.items():
            if key.lower() not in ['content-encoding', 'transfer-encoding', 'connection']:
                response_headers[key] = value
        
        return Response(
            resp.content,
            status=resp.status_code,
            headers=response_headers
        )
    except Exception as e:
        print(f"Error in normal request: {str(e)}")
        return Response(f"Request failed: {str(e)}", status=500)

def handle_sse_request(method, target_url, headers, cookies):
    """处理 SSE (Server-Sent Events) 请求"""
    def generate():
        response_queue = Queue()
        stop_event = Event()
        
        heartbeat_thread = Thread(target=heartbeat_generator, args=(response_queue, stop_event))
        heartbeat_thread.daemon = True
        heartbeat_thread.start()
        
        try:
            session = session_manager.get_session()
            
            # 打印请求详情以便调试
            print(f"SSE Request headers: {json.dumps(headers, indent=2)}")
            
            if method in ["POST", "PUT", "PATCH"]:
                raw_data = request.get_data()
                
                # 打印请求体以便调试
                try:
                    print(f"SSE Request body: {json.dumps(json.loads(raw_data), indent=2)}")
                except:
                    print(f"SSE Request body (raw): {raw_data[:200]}...")
                
                resp = session.request(
                    method, 
                    target_url, 
                    data=raw_data, 
                    headers=headers, 
                    cookies=cookies,
                    stream=True, 
                    timeout=60
                )
            else:
                resp = session.request(
                    method, 
                    target_url, 
                    headers=headers, 
                    cookies=cookies,
                    stream=True, 
                    timeout=60
                )
            
            print(f"SSE Response status: {resp.status_code}")
            print(f"SSE Response headers: {json.dumps(dict(resp.headers), indent=2)}")
            
            # 如果不是200状态码，返回错误信息
            if resp.status_code != 200:
                stop_event.set()
                error_content = resp.content
                try:
                    error_json = json.loads(error_content)
                    error_message = error_json.get('error', {}).get('message', str(error_content))
                    yield f"data: {{\"error\": \"{error_message}\"}}\n\n".encode()
                except:
                    yield f"data: {{\"error\": \"Request failed with status {resp.status_code}\"}}\n\n".encode()
                return
            
            # 正常处理流式响应
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk
                
                while not response_queue.empty():
                    response_queue.get()
            
        except Exception as e:
            print(f"Error in SSE request: {str(e)}")
            yield f"data: {{\"error\": \"SSE request failed: {str(e)}\"}}\n\n".encode()
        finally:
            stop_event.set()
            heartbeat_thread.join(timeout=1)
    
    response_headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    }
    
    return Response(
        stream_with_context(generate()),
        status=200,
        headers=response_headers
    )

if __name__ == '__main__':
    import ssl
    import os
    
    if not os.path.exists('/opt/cert.pem'):
        print("Generating self-signed certificate...")
        domains = list(PROXY_DOMAINS.keys())
        san_list = ','.join([f'DNS:{domain}' for domain in domains])
        os.system(f'openssl req -x509 -newkey rsa:4096 -nodes -out /opt/cert.pem -keyout /opt/key.pem -days 365 -subj "/CN=proxy.local" -addext "subjectAltName={san_list}"')
    
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain('/opt/cert.pem', '/opt/key.pem')
    
    app.run(host='0.0.0.0', port=443, ssl_context=context, threaded=True)
