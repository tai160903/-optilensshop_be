// Thiết lập DNS cho Node.js
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();

var express = require("express");
const connectDB = require("./config/db");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
const swaggerUi = require("swagger-ui-express");
const getOpenApiSpec = require("./docs/openapi");

// Kết nối MongoDB
connectDB();
var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const openApiSpec = getOpenApiSpec();
app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: { persistAuthorization: true },
  }),
);

app.use("/", indexRouter);

console.log(`Server is running on port ${process.env.PORT || 3000}`);
console.log(
  `Link to API documentation: http://localhost:${process.env.PORT || 3000}/api-docs `,
);

module.exports = app;
