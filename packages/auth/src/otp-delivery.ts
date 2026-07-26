import { Resend } from "resend";

export type OtpPurpose = "change-email" | "email-verification" | "forget-password" | "sign-in";

export type OtpDeliveryMessage = {
  readonly email: string;
  readonly otp: string;
  readonly purpose: OtpPurpose;
};

export type OtpDelivery = {
  readonly send: (message: OtpDeliveryMessage) => Promise<void>;
};

export type ResendOtpDeliveryOptions = {
  readonly apiKey: string;
  readonly from: string;
};

export function createResendOtpDelivery(options: ResendOtpDeliveryOptions): OtpDelivery {
  const resend = new Resend(options.apiKey);

  return {
    async send(message) {
      const { error } = await resend.emails.send({
        from: options.from,
        subject: "Your LittleArc sign-in code",
        text: `Your LittleArc code is ${message.otp}. It expires in 5 minutes.`,
        to: message.email,
      });

      if (error) {
        throw new Error("Authentication email could not be delivered.");
      }
    },
  };
}
