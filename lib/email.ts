import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@woutervellekoop.nl";

export async function sendDownloadNotification(
  slug: string,
  fileCount: number
): Promise<void> {
  try {
    await resend.emails.send({
      from: "Download Portal <noreply@wouter.photo>",
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
