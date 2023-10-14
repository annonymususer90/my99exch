const { existsSync, stat } = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { isCredentialsAvailable, infoAsync, errorAsync, warnAsync, isValidAmount } = require('./apputils');
const { login, register, lockUser, deposit, withdraw, resetPass } = require('./browse');
const { createTransaction, getTransactionsAndWorkbook } = require('./db');

require('dotenv').config();

const app = express();
const PORT = 3000;
const bodyParser = require('body-parser');
const loginCache = new Map();
const allowedDomains = ['http://fgpunt.com', 'https://fgpunt.com'];
const corsOptions = {
    origin: null,
    methods: 'POST, GET',
    credentials: false,
    optionsSuccessStatus: 204
};

var b;

puppeteer.launch({
    args: [
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--single-process',
        '--no-zygote',
        '--disable-gpu',
    ],
    executablePath:
        process.env.NODE_ENV === "production"
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
    headless: true,
    timeout: 120000,
    defaultViewport: {
        width: 1366,
        height: 768
    },
}).then((browser) => b = browser);

app.use(express.json());
app.use(bodyParser.json())
app.use(cors(corsOptions));
app.use(express.static('public'));
app.use((req, res, next) => {
    while (loginCache.get(req.body.url)?.isBusy) { }
    next();
});
app.use(async (req, res, next) => {
    if (!['/login', '/logs', '/', '/credentials', '/details', '/generate-excel'].includes(req.path)) {
        const { url } = req.body;

        if (!isCredentialsAvailable(loginCache, url)) {
            res.status(401).json({ message: 'admin credentials not available' });
            return;
        }

        let pageUrl = await loginCache.get(url).page.url();

        if (pageUrl.includes('login')) {
            loginCache.get(url).isBusy = true;
            let { page, username, password } = loginCache.get(url);
            await login(page, url, username, password, true);
            loginCache.get(url).isBusy = false;
        }
    }

    next();
});

/* *** endpoints *** */
app.get('/', (req, res) => {
    res.send('server up and running');
});

app.get('/credentials', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'addsite.html');
    res.sendFile(filePath);
});

app.get('/details', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'downloadlogs.html');
    res.sendFile(filePath);
});

app.post('/generate-excel', (req, res) => {
    const { startDate, endDate } = req.body;

    getTransactionsAndWorkbook(startDate, endDate, req.headers.host)
        .then(workbook => {
            // Set the response headers to indicate an Excel file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=log-${startDate}-${endDate}.xlsx`);

            // Write the Excel workbook to the response
            workbook.xlsx.write(res)
                .catch(err => {
                    res.status(500).send('Error generating Excel file');
                    errorAsync(err.message);
                });
        })
        .catch(err => {
            res.status(500).send('Error: ' + err);
            errorAsync(err);
        });
});

app.post('/login', async (req, res) => {
    const { url, username, password } = req.body;

    try {

        if (isCredentialsAvailable(loginCache, url)) {
            return res.status(200).json({ message: 'admin already loggedin' });
        } else {
            const page = await b.newPage();
            loginCache.set(url, {
                page: page,
                username: username,
                password: password,
                isBusy: true
            });

            loginCache.get(url).isBusy = true;
            await login(page, url, username, password);
            loginCache.get(url).isBusy = false;

            res.status(200).json({ message: 'login success to url ' + url });
        }
    } catch (ex) {
        errorAsync(ex.message);
        res.status(400).json({ message: 'login unsuccess to ' + url });
    }
});

app.post('/register', async (req, res) => {
    const page = await b.newPage();
    const { url, username } = req.body;

    try {
        const result = await register(page, url, username);
        res.status(result.success ? 200 : 300).json({ message: result.message });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
        errorAsync(`request responded with error: ${error.message}`);
    } finally {
        page.close();
    }
});

app.post('/resetpass', async (req, res) => {
    const page = await b.newPage();
    const { url, username } = req.body;

    try {
        const result = await resetPass(page, url, username);
        res.status(result.success ? 200 : 400).json({ message: result.message });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
        errorAsync(error.message);
    } finally {
        page.close();
    }
});

app.post('/deposit', async (req, res) => {

    const { url, username, amount } = req.body;
    const page = await b.newPage();
    let result;
    let responseTime;
    let status = false;

    try {
        if (!isValidAmount(amount)) {
            res.status(400).json({ message: "invalid amount format" });
            return;
        }

        infoAsync(`[req] ${url}, user: ${username}, amount: ${amount}`);
        const startTime = new Date();
        result = await deposit(page, url, username, amount);
        const endTime = new Date();
        responseTime = endTime - startTime;
        if (result.success == false) {
            res.status(400).json({ message: result.message });
            warnAsync(`[res] url: ${url}, status: ${res.statusCode}, user: ${username}, message: ${result.message} (${responseTime} ms)`);
        } else {
            res.json({ message: result.message });
            status = true;
            infoAsync(`[res] url: ${url}, status: ${res.statusCode}, user: ${username}, amount: ${amount}, message: ${result.message} (${responseTime} ms)`);
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
        errorAsync(`[res] ${url} - ${res.statusCode}, Message: ${error.message}`);
    } finally {
        page.close();
        createTransaction(url, 'd', username, amount, responseTime, result.message, status, req.headers.host);
    }
});

app.post('/withdraw', async (req, res) => {
    const { url, username, amount } = req.body;
    const page = await b.newPage();
    let result;
    let responseTime;
    let status = false;

    try {
        if (!isValidAmount(amount)) {
            res.status(400).json({ message: "invalid amount format" });
            return;
        }

        infoAsync(`[req] ${url}, user: ${username}, amount: ${amount}`);
        const startTime = new Date();
        result = await withdraw(page, url, username, amount);
        const endTime = new Date();
        responseTime = endTime - startTime;
        if (result.success == false) {
            res.status(400).json({ message: result.message });
            warnAsync(`[res] url: ${url}, status: ${res.statusCode}, user: ${username}, message: ${result.message} (${responseTime} ms)`);
        } else {
            res.json({ message: result.message });
            status = true;
            infoAsync(`[res] url: ${url}, status: ${res.statusCode}, user: ${username}, amount: ${amount}, message: ${result.message} (${responseTime} ms)`);
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
        errorAsync(error.message);
    } finally {
        page.close();
        createTransaction(url, 'w', username, amount, responseTime, result.message, status, req.headers.host)

    }
});

app.post('/lockuser', async (req, res) => {
    const { url, username } = req.body;
    const page = await b.newPage();

    try {
        const result = await lockUser(page, url, username);
        if (result.success)
            res.status(200).json({ message: result.message });
        else
            res.status(400).json({ message: result.message });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
        errorAsync(err.message);
    } finally {
        page.close();
    }
});

// app.post('/logs', (req, res) => {
//     const date = req.body.date;

//     if (!date) {
//         return res.status(400).json({ error: 'Date is required in the request body.' });
//     }

//     if (!/^\d{4}-\d{2}$/.test(date)) {
//         return res.status(400).json({ error: 'Invalid date format. Please use yyyy-mm.' });
//     }

//     const filePath = path.join(__dirname, 'logs', `combined-${date}.log`);

//     if (!existsSync(filePath)) {
//         return res.status(404).json({ error: 'Log file not found.' });
//     }

//     res.sendFile(filePath, (err) => {
//         if (err) {
//             errorAsync(err.message);
//             res.status(500).send('Error sending the file.');
//         }
//     });
// });

app.listen(PORT);

process.on('SIGINT', () => {
    b.close();
});
