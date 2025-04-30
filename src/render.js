$(document).ready(() => {
    // const articleList = articles.matchingArticles();
    const mq = window.matchMedia("(max-width: 400px)");
    const knapp = $('button#getnews');

    $(mq).on("change", () => {
        if (mq.matches) {
            knapp.text("Klikk her for å søke!")
        } else {
            knapp.text("Klikk her!") 
        }
    })

    $('form').on('submit', async e => {
        e.preventDefault()
        
        const resultInput = $('#search').val();

        const keywords = resultInput.split(',').map(item => item.trim());

        const kElement = $('.topic-container');

        // Validering av input
        if (keywords.every(word => word === '' || word === null)){
            $("ul.box3").text("No articles found, try again please.")
        } else {
            const articleList = await search.matchingArticles(resultInput);
            console.log(articleList);

            $('.result-container').remove();
            $('.term').remove();

            for (let item of articleList) {
                $('.box3').append(`
                    <li class="result-container">
                        <a href="${item.url}">
                            <div class="result-top">
                                <h4 class="headline">${item.overskrift}</h4>
                            </div>
                            <div class="result-bottom">
                                <div class="keyword">${item.stikkord.join(", ")}</div>
                                <div class="time-since">${timeDisplay(item.dato)}</div>
                            </div>
                        </a>
                    </li>     
                `)
            }
    
            for (let word of keywords){
                if (word.length > 0){
                    word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    kElement.append(`
                        <p class="term">${word}</p>
                    `)
                }
            }
    
            $('.topic-container p').css('animation', 'pulse 1s 3');
    
            setTimeout(() => {$('.topic-container p').css('animation', '')}, 3000)
    
        }        
        // window.electron.sendInput(resultInput);
    })
})

function timeDisplay(date){
    const oneDayMillisec = 1000 * 60 * 60 * 24
    const oneHourMillisec = 1000 * 60 * 60
    const oneMinuteMillisec = 1000 * 60
    const timeAgoMs = Date.now() - Date.parse(date)
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