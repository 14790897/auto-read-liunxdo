const start = async () => {
    var { connect } = await import('puppeteer-real-browser')
    const { page, browser } = await connect({})
    await page.goto("https://linux.do");
}

start()