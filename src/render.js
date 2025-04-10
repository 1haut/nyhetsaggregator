$(document).ready(() => {
    const articleList = articles.matchingArticles()

    for (let item of articleList) {
        $('.box3').append(`
            <li class="result-container">
                <a href="${item.url}">
                    <div class="result-top">
                        <h4 class="headline">${item.headline}</h4>
                    </div>
                    <div class="result-bottom">
                        <div class="keyword">${item.keywords.join(", ")}</div>
                        <div class="time-since">${timeDisplay(item.date)}</div>
                    </div>
                </a>
            </li>     
            `)
    }



    $('form').on('submit', e => {
        e.preventDefault()
        const resultInput = $('#search').val();

        const keywords = resultInput.split(',');

        const kElement = $('.topic-container');

    
        for (let word of keywords){
            if (word.trim().length > 0){
                word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase()
                kElement.append(`
                    <p class="term">${word}</p>
                `)
            }
        }


        $('.topic-container p').css('animation', 'pulse 1s 3');

        setTimeout(() => {$('.topic-container p').css('animation', '')}, 3000)

        // window.electron.sendInput(resultInput);
    })
})

function timeDisplay(date){
    const oneDayMillisec = 1000 * 60 * 60 * 24
    const oneHourMillisec = 1000 * 60 * 60
    const oneMinuteMillisec = 1000 * 60
    const timeAgoMs = Date.parse("2025-04-10T06:00:00Z") - Date.parse(date)
    let time
    switch (true) {
        case timeAgoMs > oneDayMillisec:
            
            time = `${Math.floor(timeAgoMs / oneDayMillisec)} day(s) ago`
            break;
        case timeAgoMs > oneHourMillisec:
            
            time = `${Math.floor(timeAgoMs / oneHourMillisec)} hour(s) ago`
            break;
        case timeAgoMs > oneMinuteMillisec :
            
            time = `${Math.floor(timeAgoMs / oneMinuteMillisec)} minute(s) ago`
            break;
        case timeAgoMs > oneMinuteMillisec / 60:
            
            time = `${Math.floor(timeAgoMs / ( oneMinuteMillisec / 60 ) )} seconds ago`
            break;

        default:
            time = `less than a second ago`
            break;
    }

    return time
}