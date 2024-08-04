 [中文文档](./README_zh.md)

## Method 1: Tampermonkey Script

The Tampermonkey script can be accessed in the `index_passage_list`. You can find and install the script from Greasy Fork:

![alt text](image.png)
[Tampermonkey Script: Auto Read](https://greasyfork.org/en/scripts/489464-auto-read)

## Method 2: Headless Execution with Puppeteer

### 1. Setting Environment Variables

Set your username and password in the `.env` file.

### 2. Execution

#### For Windows

Run the following commands:

```sh
npm install
node .\pteer.js
```

#### For Linux (additional packages needed)

Install the required packages and run the same commands as for Windows:

```sh
sudo apt-get update
sudo apt install nodejs npm -y
sudo apt-get install -y wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

## Method 3: GitHub Actions for Daily Reading at Midnight

Modify the start time and duration as needed. The code is located in `.github/workflows/cron_read.yaml`.

### 1. Fork the Repository

### 2. Set Environment Variables

Set the username and password in the secrets of GitHub actions (variable names can be referred from `.env`). Note that setting the environment variables in `.env` here does not work for GitHub actions.
![alt text](image2.png)

### 3. Start the Workflow

Tutorial: [Enable Automatic Updates](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web?tab=readme-ov-file#enable-automatic-updates)

## Method 4: Docker Execution

### 1. Immediate Execution

Clone the repository, set environment variables in `docker-compose.yml`, and run:

```sh
docker-compose up -d
```

To view logs:

```sh
docker-compose logs -f
```

### 2. Scheduled Execution

Set permissions and edit the crontab:

```sh
chmod +x cron.sh
crontab -e
```

Manually add the following entry (to execute daily at 6 AM, adjust the directory as needed):

```sh
0 6 * * * /root/auto-read-linuxdo/cron.sh  # Note this is a sample directory, change to your repository's cron.sh directory (use pwd to find your directory)
```

#### Additional Information

The external script is used for puppeteer and is modified from `index_passage_list.js`. Main modifications include removing buttons and setting automatic reading and liking to start by default:

```sh
localStorage.setItem("read", "true"); // Initially disables auto-scroll
localStorage.setItem("autoLikeEnabled", "true"); // Auto-liking is enabled by default
```
