// Import necessary modules and libraries
const { errorAsync, infoAsync } = require('./apputils'); // Import custom utilities
const mysql = require('mysql2'); // Import the MySQL module
const ExcelJS = require('exceljs'); // Import the ExcelJS library for working with Excel files

// Create the connection pool to the database
const pool = mysql.createPool({
    host: '68.178.166.5',
    user: 'world777',
    password: 'world777',
    database: 'world777api',
    connectionLimit: 10 // Set the maximum number of connections in the pool
});

// Function to create a new transaction record in the database
function createTransaction(url, type, username, amount, timeTook, message, status, domain) {
    pool.getConnection((err, conn) => {
        if (err) {
            // Log an error message if there's an issue with the connection
            errorAsync(err.message);
        }

        conn.query(
            'insert into transaction (url, type, username, amount, time_took, message, status, domain) values (?, ?, ?, ?, ?, ?, ?, ?);',
            [url, type, username, amount, timeTook, message, status, domain],
            (queryError, results) => {
                conn.release(); // Release the database connection

                if (queryError) {
                    // Log an error message if there's an issue with the query execution
                    errorAsync(queryError.message);
                } else {
                    // Log information about the successful query execution
                    infoAsync(results);
                }
            }
        );
    });
}

function incrementDay(dateString) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
}

// Function to retrieve transaction data within a specified date range and create an Excel workbook
function getTransactionsAndWorkbook(startDate, endDate, domain) {
    return new Promise((resolve, reject) => {
        // Get transactions
        pool.getConnection((err, connection) => {
            if (err) {
                reject('Error connecting to the database: ' + err.message);
                return;
            }

            endDate = incrementDay(endDate);

            connection.query(
                "SELECT id, domain, url as 'website url', CASE WHEN type = 'd' THEN 'deposit' else 'withdraw' end as 'type of transaction', username, amount, time_of_transaction as 'time of transaction', message, case when status = 1 then 'true' else 'false' end as 'status of transaction' FROM transaction WHERE (time_of_transaction BETWEEN ? AND ?) AND domain = ?",
                [startDate, endDate, domain],
                (queryError, results) => {
                    connection.release();
                    if (queryError) {
                        reject('Error executing the query: ' + queryError.message);
                    } else {
                        // Map the query results to an array of objects
                        const data = results.map(result => ({ ...result }));

                        // Create an Excel workbook
                        if (!Array.isArray(data) || data.length === 0) {
                            reject('No data to export to Excel.');
                        } else {
                            const workbook = new ExcelJS.Workbook();
                            const worksheet = workbook.addWorksheet('Sheet 1');

                            // Add a row for column headers
                            const columns = Object.keys(data[0]);
                            if (columns.length === 0) {
                                reject('No columns found in results.');
                            }
                            worksheet.addRow(columns);

                            // Add rows for data
                            data.forEach(result => {
                                // Use numFmt to set the date and time format for the timestamp column
                                const rowValues = Object.values(result).map((value, index) => {
                                    if (columns[index] === 'time of transaction') {
                                        return value.toISOString().slice(0, 19).replace("T", " ");
                                    }
                                    return value;
                                });
                                worksheet.addRow(Object.values(rowValues));
                            });

                            resolve(workbook);
                        }
                    }
                }
            );
        });
    });
}

// Export the functions to make them accessible from other modules
module.exports = {
    createTransaction: createTransaction,
    getTransactionsAndWorkbook: getTransactionsAndWorkbook,
};
