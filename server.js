const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000; // You can choose any available port

app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const title = await page.$eval('h1', (element) => element.textContent);
    const paragraphs = await page.$$eval('p', (elements) => elements.map((element) => element.textContent));

    await browser.close();

    const content = {
      title,
      paragraphs,
    };

    res.status(200).json(content);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
