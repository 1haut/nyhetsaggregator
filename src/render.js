$(document).ready(() => {
    $('#getnews').on('click', () => {
        const resultInput = $('#words').val();
        alert(resultInput)
        window.electron.sendInput(resultInput);
    })
})