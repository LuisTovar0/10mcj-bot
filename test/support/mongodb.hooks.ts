import mongoose from "mongoose";

export const mochaHooks = {
  async afterAll() {
    await mongoose.disconnect();
  },
};
