const departmentService = require("./department.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");
const {
  withCache,
  buildRequestCacheKey,
  invalidateCacheNamespace
} = require("../../utils/cache");

const DEPT_NAMESPACE = "departments";

exports.create = async (req, res) => {
  try {
  const data = await departmentService.create(req);
  await invalidateCacheNamespace(DEPT_NAMESPACE);
  res.status(201).json(
    buildSuccessResponse({
      message: "Department created successfully",
      data
    })
  );
} catch (error) {
  res.status(500).json(
    buildSuccessResponse({
      message: "Error creating department",
      error: error.message
    })
  );
};
}

exports.update = async (req, res) => {
  const data = await departmentService.update(req);
  await invalidateCacheNamespace(DEPT_NAMESPACE);
  res.json(
    buildSuccessResponse({
      message: "Department updated successfully",
      data
    })
  );
};

exports.remove = async (req, res) => {
  await departmentService.remove(req);
  await invalidateCacheNamespace(DEPT_NAMESPACE);
  res.json(
    buildSuccessResponse({
      message: "Department deleted successfully"
    })
  );
};

exports.list = async (req, res) => {
  const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";
  const data = includeInactive
    ? await departmentService.list(req)
    : await withCache({
        namespace: DEPT_NAMESPACE,
        key: buildRequestCacheKey(req, { version: "v2" }),
        ttlSeconds: Number(process.env.CACHE_TTL_DEPARTMENTS || 300),
        producer: () => departmentService.list(req)
      });
  res.json(
    buildSuccessResponse({
      message: "Departments fetched successfully",
      data
    })
  );
};
