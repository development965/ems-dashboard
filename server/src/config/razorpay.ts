import Razorpay from "razorpay";
import { env } from "@/config/env.js";

export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! })
  : null;
