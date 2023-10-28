const { existsSync, stat } = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { isCredentialsAvailable, infoAsync, errorAsync, warnAsync, isValidAmount } = require('./apputils');
const { isLoggedIn, login, register, lockUser, deposit, withdraw, resetPass } = require('./browse');
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
    headless: false,
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
    try {
        if (!['/login', '/logs', '/', '/credentials', '/details', '/generate-excel'].includes(req.path)) {
            const { url } = req.body;

            if (!isCredentialsAvailable(loginCache, url)) {
                res.status(401).json({ message: 'admin credentials not available' });
                return;
            }

            if (!isLoggedIn(loginCache.get(url).page)) {
                loginCache.get(url).isBusy = true;
                let { page, username, password } = loginCache.get(url);
                let result = await login(page, url, username, password, true);

                if (result.status)
                    res.status(400).json({ message: result.message });

                loginCache.get(url).isBusy = false;
                return;
            }
        }

        next();
    } catch (err) {
        errorAsync(err.message);
        return res.status(500).send();
    }
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

// This route handles the login process when a POST request is made to '/login'.
app.post('/login', async (req, res) => {
    // Extract the URL, username, and password from the request body.
    const { url, username, password } = req.body;

    // Check if a user is already logged in based on the 'loginCache'.
    if (
        loginCache.has(url) &&
        loginCache.get(url).page &&
        !await loginCache
            .get(url)
            .page
            .url()
            .toLowerCase()
            .includes('login')
    ) {
        // If a user is already logged in, send a response indicating an admin is logged in.
        return res.status(200).send('Admin is already logged in');
    }

    // Create a new page for the login process using a headless browser.
    const page = await b.newPage();
    try {
        // Check if credentials for the 'url' are already stored in the 'loginCache'.
        if (loginCache.has(url)) {
            // Update the 'isBusy' flag and close the existing page, if it exists.
            loginCache.set(url, {
                ...loginCache.get(url),
                isBusy: true
            });
            loginCache.get(url).page?.close();
        }

        // Store the page, username, password, and 'isBusy' flag in the 'loginCache'.
        loginCache.set(url, {
            page: page,
            username: username,
            password: password,
            isBusy: true
        });

        // Perform the login operation using the 'page', 'url', 'username', and 'password'.
        let result = await login(page, url, username, password, false);

        // Send a response with a 200 status if the login was successful, or a 400 status if it failed.
        res.status(result.status ? 200 : 400).json({ message: result.message });
    } catch (ex) {
        // Handle any exceptions that may occur during the login process and log an error.
        errorAsync(ex.message);
        // Send a response with a 500 status to indicate an internal server error.
        res.status(500).json({ message: 'Login unsuccessful to ' + url });
    } finally {
        // Set the 'isBusy' flag to indicate that the login process is complete.
        loginCache.get(url).isBusy = false;
    }
});

app.post('/register', async (req, res) => {
    const page = await b.newPage();
    const { url, username } = req.body;

    try {
        const result = await register(page, url, username);
        res.status(result.success ? 200 : 400).json({
            message: result.message,
            username: result.username,
            defaultPassword: (result.success === true) ? result.password : ''
        });
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
