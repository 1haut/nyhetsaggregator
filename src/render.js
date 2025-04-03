$(document).ready(() => {
    $('#getnews').on('click', () => {
        const resultInput = $('#words').val();
        alert(resultInput)
        window.electron.sendInput(resultInput);
    })
})


// document.getElementById("getnews").addEventListener("click", () => {
//     const inputValue = document.getElementById("userInput").value;
//     window.electron.sendInput(inputValue); // Sends to main process
// });