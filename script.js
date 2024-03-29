
const title_div = document.querySelector("#title");
const error_div = document.querySelector("#error-logs");
const items = document.querySelector("#items");

const moodle_url = "https://moodle.astanait.edu.kz/webservice/rest/server.php?";
const allowed_types = ['due', 'close']
const current_time = new Date();
const timestamp = current_time.getTime() / 1000;

const tg = window.Telegram.WebApp;
let data;
try {
    data = JSON.parse(atob(tg.initDataUnsafe.start_param));
} catch (e) {
    data = {token: '', min_startdate: 0};
}
const moodle_data = data;

if (!moodle_data.token) {
    title_div.innerHTML = 'Invalid token';
    error_div.innerHTML += `Invalid token: '${moodle_data.token}' <br>`;
    throw new Error(`invalid token: ${moodle_data.token}`);
}

const append_events = (events) => {
    const current_time = new Date();
    var id = 0;
    for (const event of events) {
        var cname = event.course.fullname;
        cname = cname.split(" | ", 1)[0];

        var vname = event.name;
        vname = vname.replace(" is due", "");
        vname = vname.replace(" closes", "");

        var time =  new Date(event.timestart * 1000);
        var fDate = time.toLocaleString("ru-RU");

        var dtime = (time - current_time) / 1000;

        const node = `
            <div class="item">
                <input class="toggle" type="checkbox" id="ddl-${id}">
                <label for="ddl-${id}">📝 ${vname}</label><a target="blank" href="${event.url}">🔗</a>
                <div class="collapse">
                    📚 ${cname} <br>
                    ⏰ ${fDate}
                </div>
                <div class="updatetime" timestamp="${time.getTime()}">
                    ⏳ ${format_dtime(dtime)} left
                </div>
            </div>
        `;
        items.appendChild(to_html(node));
        id += 1;
    }

    if (events.length) {
        title_div.textContent = "All Deadlines 🫡";
    } else {
        title_div.textContent = "No Deadlines 🥳";
    }
}

const update_coutdown = () => {
    const current_time = new Date();
    const timers = [...document.querySelectorAll(".updatetime")];
    for (const timer of timers) {
        var timestamp = parseInt(timer.getAttribute("timestamp"));
        var dtime = (timestamp - current_time) / 1000;
        timer.innerHTML = `⏳ ${format_dtime(dtime)} left`;
    }
}

const get_all_events = async () => {
    var year = current_time.getFullYear();
    var month = current_time.getMonth()+1;

    var promises = [];
    for (var i = 0; i < 3; i++) {
        promises.push(get_events(year, month));
        [year, month] = get_next_date(year, month);
    }

    var data = await Promise.all(promises);
    var events = [].concat(...data);

    if (error_div.innerHTML.length) {
        return [];
    }

    events.sort(function(a, b) {
        var keyA = a.timestart,
            keyB = b.timestart;
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    });

    return events
}

const get_events = async (year, month) => {
    var params = {
        "wstoken": moodle_data.token,
        "moodlewsrestformat": "json",
        "wsfunction": "core_calendar_get_calendar_monthly_view",
        "year": year,
        "month": month
    }

    new_url = moodle_url + new URLSearchParams(params).toString();
    var data = await fetch(new_url)
        .then(async (res) => { return await res.json(); })
        .then((data) => { return data; })
        .catch((error) => {
            title_div.innerHTML = 'Something went wrong 😶';
            error_div.innerHTML = `Could not connect to server.<br>Error: "${error}"`;
        });
    
    if (error_div.innerHTML.length) {
        return [];
    }

    if (data.errorcode) {
        error_div.innerHTML += data.errorcode + '<br>';
        return [];
    }
    
    var events = [];
    for (const week of data.weeks) {
        for (const day of week.days) {
            for (const event of day.events) {
                if (allowed_types.includes(event.eventtype) && event.timestart > timestamp && event.course.startdate >= moodle_data.min_startdate) {
                    events.push(event);
                }
            }
        }
    }

    return events;
};

const format_dtime = (dtime) => {
    var text = "";
    var days = Math.floor(dtime / (60 * 60 * 24));
    var hours = Math.floor((dtime % (60 * 60 * 24)) / (60 * 60));
    var minutes = Math.floor((dtime % (60 * 60)) / 60);
    var seconds = Math.floor(dtime % 60);

    if (days > 0) {
        text += `${days} day${days > 1 ? "s" : ""} `;
    }
    if (hours > 0 && days < 2) {
        text += `${hours} hr${hours > 1 ? "s" : ""} `;
    }
    if (minutes > 0 && days < 2) {
        text += `${minutes} min${minutes > 1 ? "s" : ""} `;
    }
    if (seconds > 0 && hours == 0 && days == 0) {
        text += `${seconds} sec${seconds > 1 ? "s" : ""} `;
    }

    return text;
}

const to_html = (string) => {
    var temp = document.createElement('div');
    temp.innerHTML = string;
    return temp.firstElementChild;
}

const get_next_date = (year, month) => {
    if (month == 12) {
        return [year + 1, 1]
    }
    return [year, month + 1]
}

get_all_events().then(events => {
    if (error_div.innerHTML.length) {
        title_div.innerHTML = 'Something went wrong 😶'
        return;
    }
    append_events(events);
    setInterval(() => {
        update_coutdown();
    }, 1000);
});
