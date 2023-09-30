const { defaultPassword } = require('./constant');
const { infoAsync, errorAsync } = require('./apputils');

async function searchUser(page, url, username) {
    await page.goto(`${url}`, { timeout: 120000 });
    await page.waitForSelector('body > header > nav > div > ul.right.hide-on-med-and-down > li:nth-child(5) > a', { timeout: 120000 })
        .then(element => element.click());
    await page.waitForSelector('#listUser > li:nth-child(1) > a', { timeout: 120000 })
        .then(element => element.click());
    await page.waitForSelector('#search-user', { timeout: 120000 });
    await page.waitForSelector('#search-user')
        .then(element => element.type(username + "\n"));

    await page.waitForNavigation({ timeout: 120000 });
    await page.evaluate(`
            document.querySelector('tbody').children[0].children[0].children[1].innerText;
            `, { timeout: 6000 })
        .catch(() => {
            throw new Error("invalid username");
        });
}

async function login(page, url, username, password) {
    await page.goto(url, { timeout: 90000 });
    await page.waitForXPath('/html/body/div[1]/div/div/div[2]/div/form/div[1]/input')
        .then(
            await page.type('#username', username),
            await page.type('#password', password)
        );


    await page.evaluate(`document.querySelector('label[for="remember_me"]').click();`);
    await page.click('#login-form > div:nth-child(5) > button');
    await page.waitForSelector('body > h6', { timeout: 12000 });
    infoAsync(`login successful, url: ${url}`);
}

async function register(page, url, username) {
    try {
        await page.goto(`${url}`, { timeout: 120000 });
        await page.waitForSelector('body');
        await page.waitForSelector('body > header > nav > div > ul > li:nth-child(6) > a')
            .then(element => element.click());

        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[1]/input', { timeout: 120000 })
            .then(element => element.type(username))
            .catch(err => console.log(err));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[2]/input', { timeout: 120000 })
            .then(element => element.type(username));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[3]/input', { timeout: 120000 })
            .then(element => element.type(defaultPassword));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[4]/label', { timeout: 120000 })
            .then(element => element.type(defaultPassword + '\n'));
        // await page.waitForNavigation('body > main > div > div > div > div > div > div > div > form > div:nth-child(12) > input', { timeout: 120000 })
        //     .then(ele => ele.click());

        await page.waitForNavigation({ timeout: 1000 })
            .catch(async err => {
                let url = await page.url();
                if (url !== null && url !== `${url}/activeusers`) {
                    throw new Exception("invalid username");
                }
            });

        return { success: true }

    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: "invalid username" };
    }
}

async function resetPass(page, url, username) {
    await login(page, url, "abhiag", "Dubai@1234");
    try {
        await searchUser(page, url, username);
        await page.click('body > main > div > table > tbody > tr:nth-child(1) > td.col.s12.hide-on-med-and-down > div > a:nth-child(6)');

        await page.waitForSelector('body > div.swal-overlay.swal-overlay--show-modal > div > div.swal-text');
        await page.evaluate(`document.querySelector('body > div.swal-overlay.swal-overlay--show-modal > div > div.swal-footer > div:nth-child(2) > button').click();`);

        await page.waitForSelector('body > main > div:nth-child(1) > div > ul > li');
        let element = await page.$('body > main > div:nth-child(1) > div > ul > li');
        let value = await page.evaluate(el => el.textContent, element);

        return { success: true, message: value };
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

async function lockUser(page, url, username) {
    try {
        await searchUser(page, url, username);

        let alreadyLocked = await page.evaluate(`document.querySelector('body > main > div > table > tbody > tr:nth-child(1) > td:nth-child(7) > a').classList.contains('red')`);
        if (alreadyLocked) {
            return { success: true, message: 'already locked' };
        }

        await page.waitForSelector(`body > main > div > table > tbody > tr:nth-child(1) > td:nth-child(7) > a`)
            .then(element => element.click());

        await page.waitForSelector(`body > div.swal-overlay.swal-overlay--show-modal > div > div.swal-footer > div:nth-child(2) > button`)
            .then(element => element.click());

        await page.waitForSelector('body > main > div:nth-child(1) > div > ul > li');

        let element = await page.$('body > main > div:nth-child(1) > div > ul > li');
        let value = await page.evaluate(el => el.textContent, element);

        return { success: true, message: value };
    } catch (error) {
        return { success: false, message: error.message };
    }
}


async function deposit(page, url, username, amount) {
    try {
        await searchUser(page, url, username);
        await page.click('body > main > div > table > tbody > tr:nth-child(1) > td.col.s12.hide-on-med-and-down > div > a:nth-child(2)');
        await page.waitForSelector('#amount', { timeout: 120000 });
        amount = amount;
        let res = await page.evaluate(`
            document.querySelector('#amount').value = ${amount};
            document.querySelector('button[type="submit"]').click();
        `);

        await page.waitForSelector('body > main > div:nth-child(1) > div > ul > li');
        let element = await page.$('body > main > div:nth-child(1) > div > ul > li');
        let value = await page.evaluate(el => el.textContent, element);

        return { success: true, message: value };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function withdraw(page, url, username, amount) {
    try {
        await searchUser(page, url, username);
        await page.click('body > main > div > table > tbody > tr:nth-child(1) > td.col.s12.hide-on-med-and-down > div > a:nth-child(3)');
        await page.waitForSelector('#amount', { timeout: 120000 });
        amount = amount;
        let res = await page.evaluate(`
            document.querySelector('#amount').value = ${amount};
            document.querySelector('button[type="submit"]').click();
        `);

        await page.waitForSelector('body > main > div:nth-child(1) > div > ul > li');
        let element = await page.$('body > main > div:nth-child(1) > div > ul > li');
        let value = await page.evaluate(el => el.textContent, element);

        return { success: true, message: value };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    login: login,
    register: register,
    lockUser: lockUser,
    deposit: deposit,
    withdraw: withdraw,
    resetPass: resetPass
}