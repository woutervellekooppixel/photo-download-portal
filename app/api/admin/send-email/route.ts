import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getMetadata, getSignedDownloadUrl } from "@/lib/r2";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { slug, recipientEmail, customMessage } = await request.json();

    if (!slug || !recipientEmail) {
      return NextResponse.json(
        { error: "Slug en email zijn verplicht" },
        { status: 400 }
      );
    }

    // Get metadata
    const metadata = await getMetadata(slug);
    if (!metadata) {
      return NextResponse.json(
        { error: "Upload niet gevonden" },
        { status: 404 }
      );
    }

    // Get preview image URL
    let previewImageUrl = "";
    const previewFile = metadata.previewImageKey
      ? metadata.files.find(f => f.key === metadata.previewImageKey)
      : metadata.files.find(f => f.type.startsWith("image/"));

    if (previewFile) {
      previewImageUrl = await getSignedDownloadUrl(previewFile.key);
    }

    // Calculate total size
    const totalSize = metadata.files.reduce((acc, f) => acc + f.size, 0);
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
    };

    // Format expiry date
    const expiryDate = new Date(metadata.expiresAt).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Build download URL
    const downloadUrl = `https://download.wouter.photo/${slug}`;

    // Get title for subject and email
    const transferTitle = metadata.title || slug;
    const emailSubject = metadata.title 
      ? `${metadata.title} - Je foto's staan klaar! 📷`
      : "Je foto's staan klaar! 📷";

    // Format custom message - convert newlines to <br> tags
    const formattedCustomMessage = customMessage 
      ? customMessage.replace(/\n/g, '<br>')
      : '';

    // Send email
    const { data, error } = await resend.emails.send({
      from: "Wouter Vellekoop <noreply@wouter.photo>",
      replyTo: "info@woutervellekoop.nl",
      to: recipientEmail,
      subject: emailSubject,
      html: `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${transferTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          
          ${previewImageUrl ? `
          <!-- Preview Image (clickable) -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <a href="${downloadUrl}" style="display: block;">
                <img src="${previewImageUrl}" alt="Preview" style="width: 100%; height: auto; display: block; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" />
              </a>
            </td>
          </tr>
          ` : ""}
          
          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);">
              
              ${customMessage ? `
              <!-- Custom Message -->
              <div style="margin-bottom: 24px; background-color: #ffffff;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">${formattedCustomMessage}</p>
              </div>
              ` : ''}
              
              <!-- Standard Message (always shown) -->
              <div style="margin-bottom: 32px; background-color: #ffffff;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
                  ${!customMessage ? 'Hi,<br><br>' : ''}
                  Je download link staat hieronder klaar. De foto's zijn beschikbaar tot ${expiryDate} en je kunt ze zo vaak downloaden als je wilt.
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; padding: 16px 48px; background: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      📸 Download foto's
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <div style="margin-bottom: 32px; background-color: #ffffff;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
                  Vragen of opmerkingen? Stuur me gerust een berichtje!<br><br>
                  Groetjes,<br>
                  <strong>Wouter Vellekoop</strong>
                </p>
              </div>

              <!-- Social Icons -->
              <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="https://instagram.com/woutervellekoop" style="display: inline-block; margin: 0 8px;">
                      <img src="https://cdn.simpleicons.org/instagram/000000" alt="Instagram" style="width: 24px; height: 24px;" />
                    </a>
                    <a href="https://facebook.com/wvellekoop" style="display: inline-block; margin: 0 8px;">
                      <img src="https://cdn.simpleicons.org/facebook/000000" alt="Facebook" style="width: 24px; height: 24px;" />
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Logo -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <div style="color: #000000; font-size: 14px; letter-spacing: 2px;">
                      <span style="font-weight: 700;">WOUTER</span><span style="font-weight: 400;">.</span><span style="font-weight: 300;">PHOTO</span>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Email verzenden mislukt", details: error },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data?.id);
    return NextResponse.json({
      success: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Email verzenden mislukt", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
