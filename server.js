var express = require('express'); //Ensure our express framework has been added
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var pgp = require('pg-promise')();
var User = require('./models/user');

var app = express();
app.use(morgan('dev'));
app.use(bodyParser.json());              // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true  })); // support encoded bodies
app.use(cookieParser());

app.use(session({
  key: 'user_sid',
  secret: process.env.KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 600000
  }
}));

app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');
  }
  next();
});

var sessionChecker = (req, res, next) => {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect('/saved-events');
  } else {
    next();
  }
};

const dbConfig = process.env.DATABASE_URL;
/*const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'igru',
  user: 'postgres',
  password: 'fish'
}; */


var db = pgp(dbConfig);

// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));

function stripText(input) {
  input = input.replace('"','');
  input = input.replace("'","");
  input = input.replace('<','');
  input = input.replace('>','');
  return input;
}

app.route('/signup')
  .get(sessionChecker, (req, res) => {
    var logged_in = 0;
    if (req.session.user && req.cookies.user_sid) {
      logged_in = 1;
    }
    res.render('pages/sign_up', {
      m_title: "Sign Up",
      logged_in:logged_in
    })
  })
  .post((req, res) => {
    User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      admin: 0
    })
    .then(user => {
      req.session.user = user.dataValues;
      res.redirect('/');
    })
    .catch(error => {
      console.log(error);
      res.redirect('/signup');
    });
  });

app.route('/login')
  .get(sessionChecker, (req, res) => {
    res.render('pages/login', {
      m_title:'Login',
      logged_in:0,
      response:''
    })
  })
  .post((req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    User.findOne({ where:{ username: username}}).then(function (user){
      if (!user) {
        res.redirect('/login_error');
      } else if (!user.validPassword(password)) {
        res.redirect('/login_error');
      } else {
        req.session.user = user.dataValues;
        res.redirect('/');
      }
    });
  });

app.get('/login_error', sessionChecker, (req, res) => {
  res.render('pages/login', {
    m_title: "Login",
    logged_in:0,
    response: "Invalid username or password."
  })
});

app.get('/logout', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid');
    res.redirect('/');
  } else {
    res.redirect('/login');
  }
});

// Landing Page
app.get('/', function(req, res) {
  var logged_in = 0;
  if (req.session.user && req.cookies.user_sid) {
    logged_in = 1;
  }
  var query = "select * from events order by start_date_time limit 3";
  db.any(query)
    .then(function (rows) {
      res.render('pages/home', {
        m_title:"CU Boulder Event Manager",
        logged_in:logged_in,
        local_css:"search.css",
        data: rows
      })
    })
    .catch(function (err) {
      console.log("Error fetching events for home.");
      res.render('pages/home', {
        m_title:"CU Boulder Event Manager",
        logged_in:logged_in,
        local_css:"search.css",
        data:""
      });
    })
});

app.get('/saved-events', function(req, res) {
  var logged_in = 0;
  if (req.session.user && req.cookies.user_sid) {
    logged_in = 1;
  }
  res.render('pages/my_saved_events', {
    m_title:"Saved Events",
    logged_in:logged_in,
    local_css:"search.css"
  });
});

app.get('/search', function(req, res) {
  var logged_in = 0;
  if (req.session.user && req.cookies.user_sid) {
    logged_in = 1;
  }
  var get_events = "select * from events;";
  db.any(get_events)
  .then(function (events) {
    res.render('pages/search', {
      m_title:"Event Search",
      logged_in:logged_in,
      local_css:"search.css",
      events:events
    })
  })
  .catch(function (error) {
    console.log(error);
    res.render('pages/search', {
      m_title:"Event Search",
      logged_in:logged_in,
      local_css:"search.css",
      events:''
    })
  })
});

app.route('/registration')
  .get(function(req, res) {
    var logged_in = 0;
    if (req.session.user && req.cookies.user_sid) {
      logged_in = 1;
    }
    res.render('pages/registration', {
      m_title:"Organization Registration",
      logged_in:logged_in,
      response:'',
      err:''
    })
  })
  .post(function(req, res) {
    var logged_in = 0;
    if (req.session.user && req.cookies.user_sid) {
      logged_in = 1;
    }
    var organization_name = req.body.org_name;
    var contact = req.body.contact;
    organization_name = stripText(organization_name);
    contact = stripText(contact);
    var query = "insert into organizations (org_name, contact) values('"+organization_name+"','"+contact+"')";
    db.any(query)
      .then(function (data) {
        res.render('pages/registration', {
          m_title:"Organization Registration",
          logged_in:logged_in,
          response:"Successfully Registered Organization",
          err:''
        })
      })
      .catch(error => {
        console.log(error);
        res.render('pages/registration', {
          m_title:"Organization Registration",
          logged_in:logged_in,
          response:"Error Registering Organization:",
          err: error
        })
      })
  });

app.route('/addEvent')
  .get(function(req, res) {
    var logged_in = 0;
    if (req.session.user && req.cookies.user_sid) {
      logged_in = 1;
    }
    var query = "select org_name,organization_id from organizations order by org_name;";
    db.any(query)
      .then(function (rows) {
        res.render('pages/addEvent', {
          m_title:'Add Event',
          logged_in:logged_in,
          data:rows,
          response:''
        })
      })
      .catch(function (err) {
        console.log("Error fetching organizations for addEvent.");
        console.log(err);
        res.render('pages/addEvent', {
          m_title:'Add Event',
          logged_in:logged_in,
          data:'',
          response:'Error fetching organizations'
        });
      })
  })
  .post(function(req, res) {
    var logged_in = 0;
    if (req.session.user && req.cookies.user_sid) {
      logged_in = 1;
    }
    var title = req.body.eventName;
    var time = req.body.date;
    var location = req.body.location;
    var id = req.body.organization;
    var description = req.body.description;
    var attribute = 0;
    if (req.body.t_academic)
      attribute += req.body.t_academic;
    if (req.body.t_clubs)
      attribute += req.body.t_clubs;
    if (req.body.t_sports)
      attribute += req.body.t_sports;
    if (req.body.t_fundraising)
      attribute += req.body.t_fundraising;
    if (req.body.t_music)
      attribute += req.body.t_music;
    if (req.body.t_talks)
      attribute += req.body.t_talks;
    if (req.body.t_other)
      attribute += req.body.t_other;
    var query_org = "select org_name,organization_id from organizations order by org_name;";
    var query_insert ="insert into events "
                    + "(event_title, start_date_time, location, attribute, description, organization_id, contact) "
                    + "values ('"+title+"','"+time+"','"+location+"','"+attribute+"','"+description+"','"+id+"',"
                    + "(select contact from organizations where organization_id="+id+"));";
    //var query_org_update ="update organizations set upcoming_events=("
    //                    + "(select upcoming_events from organizations where organization_id="req.body.organization") || ARRAY[""]"
    db.task('get-everything', task => {
      return task.batch([
        task.any(query_org),
        task.any(query_insert),
        //task.any(query_org_update)
      ])
    })
    .then(info => {
      res.render('pages/addEvent', {
        m_title:'Add Event',
        logged_in:logged_in,
        data: info[0],
        response:'Successfully submitted event'
      })
    })
    .catch(error => {
      console.log(error);
      res.render('pages/addEvent', {
        m_title:'Add Event',
        logged_in:logged_in,
        data:'',
        response:'Error submitting event'
      })
    })
  });

app.get('/user', function(req, res) {
  var logged_in = 0;
  if (req.session.user && req.cookies.user_sid) {
    logged_in = 1;
  }
  res.render('pages/user', {
    local_css:"calendar.css",
    logged_in:logged_in,
    m_title:"User Calendar"
  })
})

app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
});

var port = 3000;
port = process.env.PORT;
app.set('port', port);

app.listen(port);
console.log("Listening on port " + port);
