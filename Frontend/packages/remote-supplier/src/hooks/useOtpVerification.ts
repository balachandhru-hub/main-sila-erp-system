// Shared OTP-verification flow for the supplier-side quotation/bid submit gates
// (SupplierRfqQuotationSummary, EAuctionWidget). Both screens require the supplier
// to verify a one-time email code before their quotation/bid payload is accepted,
// and both cache the resulting token in a cookie so repeat submissions within the
// TTL skip OTP entirely.
import { useEffect, useRef, useState } from "react";
import { getSupplierProfile, sendOtp, verifyOtp } from "../api/supplierApi";
import { isErrorResponse } from "@vosox/shared-ui";

export const VERIFICATION_TOKEN_COOKIE = "vsx_verification_token";
export const VERIFICATION_TOKEN_TTL_SECONDS = 30 * 60;
export const OTP_EXPIRY_STORAGE_KEY = "vsx_otp_expiry";
export const VERIFICATION_TOKEN_STORAGE_KEY = "vsx_verification_token";
const OTP_WINDOW_MS = 10 * 60 * 1000;

export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

export const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

export type OtpStage = "none" | "send" | "verify";

export interface UseOtpVerificationOptions {
  /** Runs once a code has just been verified and a token issued (e.g. open a confirm dialog, or submit immediately). */
  onVerified: (token: string) => void | Promise<void>;
}

export function useOtpVerification({ onVerified }: UseOtpVerificationOptions) {
  const [otpStage, setOtpStage] = useState<OtpStage>("none");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpRemaining, setOtpRemaining] = useState(600);
  const supplierEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (otpStage !== "verify" || !otpExpiresAt) return;
    const computeRemaining = () => Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000));
    setOtpRemaining(computeRemaining());
    const interval = setInterval(() => {
      const left = computeRemaining();
      setOtpRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpStage, otpExpiresAt]);

  const handleSendOtp = async () => {
    setOtpError(null);
    setSendingOtp(true);
    try {
      if (!supplierEmailRef.current) {
        const profile = await getSupplierProfile();
        if (!isErrorResponse(profile) && profile && "businessProfile" in profile) {
          supplierEmailRef.current = (profile as any).businessProfile?.email || null;
        }
      }
      const res = await sendOtp();
      if (res && "statusCode" in res && (res as any).statusCode >= 400) {
        const message = (res as any).message || "";
        const description = (res as any).description || "";
        const otpAlreadySent = /already.*sent/i.test(message) || /already.*sent/i.test(description);
        if (!otpAlreadySent) {
          setOtpError(message || "Couldn't send the code, try again.");
          return;
        }
        // Backend already has a live OTP for this supplier — let them verify the one they have
        // instead of dead-ending on this error. If it's since expired server-side, verifyOtp
        // will reject it and the supplier can hit Resend once our local countdown runs out.
      }
      const expiry = Date.now() + OTP_WINDOW_MS;
      sessionStorage.setItem(OTP_EXPIRY_STORAGE_KEY, String(expiry));
      deleteCookie(VERIFICATION_TOKEN_COOKIE);
      sessionStorage.removeItem(VERIFICATION_TOKEN_STORAGE_KEY);
      setOtpExpiresAt(expiry);
      setOtpRemaining(600);
      setOtpCode("");
      setOtpStage("verify");
    } catch (err: any) {
      setOtpError(err?.message || "Couldn't send the code, try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setOtpError("Enter the code we emailed you.");
      return;
    }
    if (otpRemaining <= 0) {
      setOtpError("Code expired. Please resend the OTP.");
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await verifyOtp({ email: supplierEmailRef.current || "", otp: otpCode.trim() });
      if (!res || (res as any).success === false || ("statusCode" in res && (res as any).statusCode >= 400)) {
        setOtpError((res as any)?.message || "That code didn't match, try again.");
        return;
      }
      const token = (res as any).token;
      if (!token) {
        setOtpError("Verification failed, please retry.");
        return;
      }
      setCookie(VERIFICATION_TOKEN_COOKIE, token, VERIFICATION_TOKEN_TTL_SECONDS);
      sessionStorage.setItem(VERIFICATION_TOKEN_STORAGE_KEY, token);
      setOtpStage("none");
      await onVerified(token);
    } catch (err: any) {
      setOtpError(err?.message || "That code didn't match, try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return {
    otpStage,
    setOtpStage,
    otpCode,
    setOtpCode,
    otpError,
    setOtpError,
    sendingOtp,
    verifyingOtp,
    otpExpiresAt,
    setOtpExpiresAt,
    otpRemaining,
    setOtpRemaining,
    handleSendOtp,
    handleVerifyOtp,
  };
}
