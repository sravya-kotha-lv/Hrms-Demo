module.exports = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true
    });

    if (error) {
      return res.status(406).json({
        code: 406,
        message: error.details[0].message,
        data: null,
        error: []
      });
    }

    req[property] = value;
    next();
  };
};
