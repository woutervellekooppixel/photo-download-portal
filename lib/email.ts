import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@woutervellekoop.nl";

export async function sendDownloadNotification(
  slug: string,
  fileCount: number
): Promise<void> {
  try {
    await getResend().emails.send({
      from: "Download Notificaties <downloads@wouter.photo>",
      to: ADMIN_EMAIL,
      subject: `Download: ${slug}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Download Notificatie</h2>
          <p>Er is een download uitgevoerd:</p>
          <ul>
            <li><strong>Project:</strong> ${slug}</li>
            <li><strong>Aantal bestanden:</strong> ${fileCount}</li>
            <li><strong>Tijd:</strong> ${new Date().toLocaleString("nl-NL")}</li>
          </ul>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            Dit is een automatische notificatie van je download portal.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send email notification:", error);
    // Don't throw - email failure shouldn't break the download
  }
}
