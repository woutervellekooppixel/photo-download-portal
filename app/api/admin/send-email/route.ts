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

    // Send email
    const { data, error } = await resend.emails.send({
      from: "Wouter Vellekoop <info@woutervellekoop.nl>",
      replyTo: "info@woutervellekoop.nl",
      to: recipientEmail,
      subject: "Je foto's staan klaar! 📷",
      html: `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je foto's staan klaar</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          ${previewImageUrl ? `
          <!-- Hero Image -->
          <tr>
            <td style="padding: 0;">
              <img src="${previewImageUrl}" alt="Preview" style="width: 100%; height: auto; display: block; max-height: 400px; object-fit: cover;" />
            </td>
          </tr>
          ` : ""}
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              
              <!-- Logo/Branding -->
              <table role="presentation" style="width: 100%; margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #111827;">WOUTER.PHOTO</h1>
                    <div style="height: 2px; width: 60px; background: linear-gradient(to right, #3b82f6, #8b5cf6); margin: 12px auto 0;"></div>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <h2 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">
                Je foto's staan klaar! 📷
              </h2>

              ${customMessage ? `
              <!-- Custom Message -->
              <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 20px 24px; margin-bottom: 32px; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${customMessage}</p>
              </div>
              ` : ""}

              <!-- Details -->
              <table role="presentation" style="width: 100%; margin-bottom: 32px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Aantal foto's</td>
                        <td align="right" style="color: #111827; font-size: 14px; font-weight: 600;">${metadata.files.length}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Totale grootte</td>
                        <td align="right" style="color: #111827; font-size: 14px; font-weight: 600;">${formatBytes(totalSize)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Beschikbaar tot</td>
                        <td align="right" style="color: #111827; font-size: 14px; font-weight: 600;">${expiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                      Download je foto's
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer Note -->
              <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center; line-height: 1.5;">
                Of kopieer deze link: <a href="${downloadUrl}" style="color: #3b82f6; text-decoration: none;">${downloadUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
                Met vriendelijke groet,<br>
                <strong style="color: #111827;">Wouter Vellekoop</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                <a href="https://wouter.photo" style="color: #3b82f6; text-decoration: none;">wouter.photo</a> • 
                <a href="mailto:info@woutervellekoop.nl" style="color: #3b82f6; text-decoration: none;">info@woutervellekoop.nl</a>
              </p>
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
