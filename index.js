import express from "express";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";

const app = express();
const port = 3000;
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "whatsappclone",
  password: "",
  port: 5432,
});

app.use(session({ secret: "secret", resave: false, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.urlencoded({ extended: true }));
db.connect();

app.get("/", (req, res) => {
  res.render("home.ejs");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.get("/resister", (req, res) => {
  res.render("resister.ejs");
});
app.get("/chat", async (req, res) => {
  // console.log(req.user);
  if (req.isAuthenticated()) {
    const username = req.user.username;
    const chat = await db.query(`SELECT * FROM "${username}"`);
    const chater = [];
    for (let i = 0; i < chat.rows.length; i++) {
      if (chater.indexOf(chat.rows[i].friend_name) == -1) {
        chater.push(chat.rows[i].friend_name);
      }
    }
    res.render("chat.ejs", { username: username, chat: chater });
  } else {
    res.redirect("/login");
  }
});
app.post("/users", async (req, res) => {
  const name = req.body;
  const result = await db.query(
    "SELECT username FROM users WHERE username != $1",
    [name.name]
  );
  res.render("users.ejs", {
    user: name.name,
    users: result.rows,
  });
});
app.post("/resister", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length > 0) {
      res.send("Username already exists");
    } else {
      const result = await db.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
        [username, password]
      );
      try {
        await db.query(
          `CREATE TABLE "${username}"(friend_name TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL)`
        );
      } catch (error) {
        console.log(error);
      }
      const user = result.rows[0];
      // console.log(user);
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        res.redirect("/chat");
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/chat",
    failureRedirect: "/login",
  })
);

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        if (user.password === password) {
          return cb(null, user);
        } else {
          return cb(null, false, { message: "Invalid password" });
        }
      } else {
        return cb(null, false, { message: "Username not found" });
      }
    } catch (error) {
      return cb(null, false, { message: "Invalid password" });
    }
  })
);

app.post("/chat", async (req, res) => {
  const { user, friend } = req.body;
  const result = await db.query(
    `SELECT * FROM "${user}" WHERE friend_name = $1`,
    [req.body.friend]
  );
  res.render("message.ejs", {
    user: user,
    friend: friend,
    chat: result.rows,
  });
});

app.post("/message/post", async (req, res) => {
  await db.query(
    `INSERT INTO "${req.body.user}" (friend_name, status, message) VALUES ($1, $2, $3)`,
    [req.body.friend, "left", req.body.message]
  );
  await db.query(
    `INSERT INTO "${req.body.friend}" (friend_name, status, message) VALUES ($1, $2, $3)`,
    [req.body.user, "right", req.body.message]
  );
  const result = await db.query(
    `SELECT * FROM "${req.body.user}" WHERE friend_name = $1`,
    [req.body.friend]
  );
  res.render("message.ejs", {
    user: req.body.user,
    friend: req.body.friend,
    chat: result.rows,
  });
});

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
