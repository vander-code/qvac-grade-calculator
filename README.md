# Grade Calculator (QVAC)

Enter your grades and get your average, with optional weights, a letter grade, your highest and lowest
subjects, and the grade you need next to reach a goal. No typing? Press **Scan report card**, and the
grades are read from a photo **on your own computer**.

Text recognition uses [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK. No API key,
no cloud service, and your report card never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `ocr`, with the `OCR_LATIN` model.

## Install

You need [Node.js](https://nodejs.org) (current LTS) and a modern browser.

```bash
git clone https://github.com/YOUR-USERNAME/qvac-grade-calculator.git
cd qvac-grade-calculator
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3005** in your browser.

The first start downloads the OCR model. The calculator works while it loads.
Click **Try sample** to see it work without typing.

## How it works

- The math (weighted average, letter, goal) is plain JavaScript in the browser, so it is always exact.
- **Scan report card** shrinks your photo in the browser, sends it to the local server, and `server.js` reads the text with QVAC's `ocr`. The temporary image is deleted right away.
- Words are grouped back into lines by position, then each line like `Mathematics 92` becomes a subject and a grade. **Always check the scanned numbers**, since OCR can misread digits.
- Grades are saved in your browser's local storage. The letter scale is a list at the top of the script in `public/index.html`.

## License

MIT
