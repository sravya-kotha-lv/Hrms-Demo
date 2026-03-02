module.exports = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true
    });

    if (error) {
      const detail = error.details?.[0];
      let message = detail?.message || "Validation failed";

      // Joi root-level required errors can show as: "\"value\" is required"
      if (detail?.path?.length === 0 && detail?.type === "any.required") {
        message = property === "body"
          ? "Request body is required"
          : `Request ${property} is required`;
      }

      return res.status(406).json({
        code: 406,
        message,
        data: null,
        error: []
      });
    }

    req[property] = value;
    next();
  };
};
