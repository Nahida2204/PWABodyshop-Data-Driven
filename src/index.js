if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(registration => {
        console.log("SW Registered!", registration);
    }).catch(error => {
        console.log("SW Registration Failed: ", error);
    });
}