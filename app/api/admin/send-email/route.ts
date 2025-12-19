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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" style="max-width: 650px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
          
          ${previewImageUrl ? `
          <!-- Hero Image with Overlay -->
          <tr>
            <td style="padding: 0; position: relative;">
              <div style="position: relative; width: 100%; max-height: 400px; overflow: hidden;">
                <img src="${previewImageUrl}" alt="Preview" style="width: 100%; height: auto; display: block; max-height: 400px; object-fit: cover;" />
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding: 24px;">
                  <h2 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${transferTitle}</h2>
                </div>
              </div>
            </td>
          </tr>
          ` : `
          <!-- Title without image -->
          <tr>
            <td style="padding: 40px 40px 0;">
              <h2 style="margin: 0; color: #111827; font-size: 32px; font-weight: 700;">${transferTitle}</h2>
              <div style="height: 3px; width: 80px; background: linear-gradient(to right, #3b82f6, #8b5cf6); margin: 16px 0 0; border-radius: 2px;"></div>
            </td>
          </tr>
          `}
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Logo/Branding -->
              <table role="presentation" style="width: 100%; margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 8px; margin-bottom: 8px;">
                      <span style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 3px;">WOUTER.PHOTO</span>
                    </div>
                  </td>
                </tr>
              </table>

              ${customMessage ? `
              <!-- Custom Message -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%); border-left: 4px solid #3b82f6; padding: 24px; margin-bottom: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #1f2937; white-space: pre-wrap;">${customMessage}</p>
              </div>
              ` : `
              <!-- Default greeting -->
              <p style="margin: 0 0 32px; font-size: 18px; line-height: 1.6; color: #374151;">
                Hoi! Wat leuk dat je de foto's wilt bekijken. Ik heb ze voor je klaar gezet op een beveiligde download pagina.
              </p>
              `}

              <!-- Details -->
              <table role="presentation" style="width: 100%; margin-bottom: 32px; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #fafafa;">
                <tr>
                  <td style="padding: 18px 24px; border-bottom: 1px solid #e5e7eb; background: #ffffff;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 500;">📸 Aantal foto's</td>
                        <td align="right" style="color: #111827; font-size: 16px; font-weight: 700;">${metadata.files.length}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 24px; border-bottom: 1px solid #e5e7eb; background: #ffffff;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 500;">💾 Totale grootte</td>
                        <td align="right" style="color: #111827; font-size: 16px; font-weight: 700;">${formatBytes(totalSize)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 24px; background: #ffffff;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 500;">⏰ Beschikbaar tot</td>
                        <td align="right" style="color: #111827; font-size: 16px; font-weight: 700;">${expiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 28px;">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${downloadUrl}" style="display: inline-block; padding: 18px 56px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 18px; font-weight: 700; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2); transition: transform 0.2s;">
                      📥 Download Foto's
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer Note -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                  Of kopieer deze link:<br>
                  <a href="${downloadUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600; word-break: break-all;">${downloadUrl}</a>
                </p>
              </div>

              <!-- Security note -->
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                🔒 Beveiligde verbinding • De foto's worden automatisch verwijderd na de vervaldatum
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-top: 2px solid #e5e7eb;">
              <table role="presentation" style="width: 100%; margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 6px; margin-bottom: 12px;">
                      <span style="color: #ffffff; font-size: 14px; font-weight: 700; letter-spacing: 2px;">WOUTER.PHOTO</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px; font-size: 14px; color: #374151; text-align: center; line-height: 1.5;">
                Met vriendelijke groet,<br>
                <strong style="color: #111827; font-size: 16px;">Wouter Vellekoop</strong><br>
                <span style="color: #6b7280; font-size: 13px;">Fotograaf</span>
              </p>
              <table role="presentation" style="width: 100%; margin-top: 16px;">
                <tr>
                  <td align="center">
                    <a href="https://wouter.photo" style="display: inline-block; margin: 0 8px; color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 500;">🌐 wouter.photo</a>
                    <span style="color: #d1d5db;">•</span>
                    <a href="mailto:info@woutervellekoop.nl" style="display: inline-block; margin: 0 8px; color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 500;">✉️ info@woutervellekoop.nl</a>
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
