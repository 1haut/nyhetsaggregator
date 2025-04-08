$(document).ready(() => {
    $('form').on('submit', e => {
        e.preventDefault()
        const resultInput = $('#search').val();

        const keywords = resultInput.split(',')

        const kElement = $('.topic-container');

        for (let word of keywords){
            if (word.trim().length > 0){
                word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase()
                kElement.append(`
                    <p class="term">${word}</p>
                `)
            }
        }

        // if (keywords.length > 1 || keywords[0].trim().length > 0){
        //     for (let word of keywords){
        //         word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase()
        //         kElement.append(`
        //             <p class="term">${word}</p>
        //             `)
        //     }
        // }

        $('.topic-container p').css('animation', 'pulse 1s 3');

        setTimeout(() => {$('.topic-container p').css('animation', '')}, 3000)

        window.electron.sendInput(resultInput);
    })
})