async function getLog() {
    const startDate = document.getElementById('startdate').value;
    const endDate = document.getElementById('enddate').value;
    const logContent = document.getElementById('logContent');

    logContent.textContent = 'Fetching log...';

    try {
        const response = await fetch('/generate-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "startDate": startDate,
                "endDate": endDate
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = `log-${startDate}-${endDate}.xlsx`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            logContent.textContent = 'Log file downloaded.';
        } else {
            const errorData = await response.json();
            logContent.textContent = 'Error: ' + errorData.error;
        }
    } catch (error) {
        console.error('Error:', error);
        logContent.textContent = 'An error occurred.';
    }
}
