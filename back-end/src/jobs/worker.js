const { Worker } = require("bullmq");
const connectDB = require("../config/db");
const Organization = require("../modules/organizations/organization.model");
const { applyLeaveCreditsForOrg } = require("../modules/leaveBalances/leaveCredit.service");
const { runCarryForwardForOrg } = require("../modules/leaveCarryForward/leaveCarryForward.service");
const { notifyProbationCompleted } = require("../modules/employees/employeeLifecycle.service");
const { getQueueConnection } = require("./queue");
const { JOB_QUEUE_NAME, JOBS } = require("./queue.constants");

const processLeaveCredits = async () => {
  console.log("🟢 Worker: leave credit job started");
  const orgs = await Organization.find({}).select("_id");
  for (const org of orgs) {
    await applyLeaveCreditsForOrg(org._id);
  }
  console.log("✅ Worker: leave credit job completed");
};

const processCarryForward = async () => {
  console.log("🟢 Worker: carry forward job started");
  const orgs = await Organization.find({}).select("_id");
  for (const org of orgs) {
    await runCarryForwardForOrg(org._id);
  }
  console.log("✅ Worker: carry forward job completed");
};

const processProbationCompletion = async () => {
  console.log("🟢 Worker: probation completion job started");
  const count = await notifyProbationCompleted();
  console.log(`✅ Worker: probation completion job completed (${count} employee(s))`);
};

const processJob = async (job) => {
  switch (job.name) {
    case JOBS.LEAVE_CREDIT_DAILY:
      return processLeaveCredits();
    case JOBS.LEAVE_CARRY_FORWARD_DAILY:
      return processCarryForward();
    case JOBS.PROBATION_COMPLETION_DAILY:
      return processProbationCompletion();
    default:
      throw new Error(`Unsupported job: ${job.name}`);
  }
};

const startJobWorker = async () => {
  await connectDB();

  const worker = new Worker(JOB_QUEUE_NAME, processJob, {
    connection: getQueueConnection(),
    concurrency: Number(process.env.JOB_WORKER_CONCURRENCY || 1)
  });

  worker.on("ready", () => {
    console.log("✅ BullMQ worker ready");
  });

  worker.on("completed", (job) => {
    console.log(`✅ Job completed: ${job.name}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Job failed: ${job?.name || "unknown"}`, error?.message || error);
  });

  return worker;
};

if (require.main === module) {
  startJobWorker().catch((error) => {
    console.error("❌ Failed to start worker:", error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  startJobWorker
};
