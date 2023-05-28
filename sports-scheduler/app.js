/* eslint-disable camelcase */
/* eslint-disable eqeqeq */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const { request, response } = require("express");
const express = require("express");
const app = express();
const csrf = require("tiny-csrf");

const { User, sports, session } = require("./models");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const Session = require("express-session");
const LocalStrategy = require("passport-local");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const flash = require("connect-flash");

app.use(express.urlencoded({ extended: false }));
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(flash());
const user = require("./models/user");
// const sport = require('./models/sport')

app.use(bodyParser.json());
app.use(cookieParser("ssh!!!! some secret string"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  Session({
    secret: "this is my secret-258963147536214",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      password: "password",
    },
    (username, password, done) => {
      console.log(User);
      console.log("check here");
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid Password" });
          }
        })
        .catch((eror) => {
          return done(null, false, { message: "Invalid user credentials" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.get("/", (request, response) => {
  if (request.isAuthenticated()) {
    if (request.user.role == "admin") {
      response.redirect("/admin");
    } else {
      response.redirect("/user");
    }
  } else {
    response.render("index", {
      failure: false,
      csrfToken: request.csrfToken(),
    });
  }
});

app.post("/users", async (request, response) => {
  if (!request.body.firstname) {
    request.flash("error", "First Name cannot be empty");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Email cannot be empty");
    return response.redirect("/signup");
  }

  if (!request.body.password) {
    request.flash("error", "Password cannot be empty");
    return response.redirect("/signup");
  }
  if (!request.body.role) {
    request.flash("error", "Role cannot be empty");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hashedPwd);
  try {
    const user = await User.addUser({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
      role: request.body.role,
    });
    console.log(User);
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      }
      response.redirect("/");
    });
  } catch (error) {
    console.log(error);
    request.flash("error", error.errors[0].message);
    response.redirect("/");
  }
});

app.get("/login", (request, response) => {
  if (request.isAuthenticated()) {
    if (request.user.role == "admin") {
      response.redirect("/admin");
    } else {
      response.redirect("/user");
    }
  } else {
    response.render("login", {
      csrfToken: request.csrfToken(),
    });
  }
});

app.get("/signout", (request, response, next) => {
  console.log("/signout is called");
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (request, response) => {
    console.log("/session is called");

    if (request.user.role == "admin") {
      response.redirect("/admin");
    }
    if (request.user.role == "player") {
      response.redirect("/user");
    }
  }
);

app.get("/signup", (request, response) => {
  response.render("signup", {
    failure: false,
    csrfToken: request.csrfToken(),
  });
});

app.get(
  "/admin",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedinUser = request.user.id;
    console.log(loggedinUser);
    const allSports = await sports.getSports(loggedinUser);
    const getUser = await User.addUser(loggedinUser);

    if (request.accepts("HTML")) {
      response.render("adminAddSport", {
        getUser,
        allSports,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        getUser,
        allSports,
      });
    }
  }
);
app.get(
  "/createsport",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    response.render("sport", { csrfToken: request.csrfToken() });
  }
);

app.get(
  "/user",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedinUser = request.user.id;
    console.log(loggedinUser);
    const allSports = await sports.getSports();
    const getUser = await User.addUser(loggedinUser);
    response.render("sport", {
      getUser,
      allSports,
      csrfToken: request.csrfToken(),
    });
  }
);

app.post(
  "/createsport",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (!request.body.sport_name) {
      request.flash("error", "Sport name cannot be empty");
      return response.redirect("/createsport");
    }
    try {
      const sport = await sports.addSports({
        sport_name: request.body.sport_name,
        userId: request.user.id,
      });
      console.log(sport.sport_name);
      console.log(sport);
      const url = `/sports/${sport.id}`;
      response.redirect(url);
    } catch (error) {
      console.log(error);
      request.flash("error", error.errors[0].message);
      response.redirect("/createsport");
    }
  }
);
app.get(
  "/sports/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log(request.params.id);
    const current_sport = await sports.getSportById(request.params.id);
    console.log(current_sport.sport_name);
    // const sessionDetails = await Session.getSessions()
    const userid = request.user.id;
    response.render("sports", {
      current_sport,
      // sessionDetails,
      userid,
      csrfToken: request.csrfToken(),
    });
  }
);

module.exports = app;
