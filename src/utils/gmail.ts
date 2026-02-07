import nodemailer from "nodemailer";

const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");
const VIOMAR_STICKER_URL = APP_URL
  ? `${APP_URL}/${encodeURI("STICKER VIOMAR.png")}`
  : "";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = APP_URL ? `${APP_URL}/reset-password?token=${token}` : "";

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Recuperación de contraseña",
    text:
      `VIOMAR\n\n` +
      `Solicitud de recuperación de contraseña\n\n` +
      `Token: ${token}\n` +
      `Expira en 30 minutos.\n` +
      (resetUrl ? `\nEnlace directo: ${resetUrl}\n` : ""),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.45;">
        <div style="text-align:center; margin: 12px 0 18px;">
          ${VIOMAR_STICKER_URL ? `<img src="${VIOMAR_STICKER_URL}" alt="VIOMAR" style="max-width: 160px; height: auto;" />` : ""}
        </div>

        <h2 style="margin: 0 0 10px; font-size: 18px;">Recuperación de contraseña</h2>
        <p style="margin: 0 0 12px;">Usa este token para restablecer tu contraseña:</p>

        <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; display: inline-block;">
          <div style="font-size: 14px; color: #374151; margin-bottom: 6px;">Token</div>
          <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${token}</div>
        </div>

        <p style="margin: 12px 0 0; font-size: 13px; color: #374151;">Este token expira en <strong>30 minutos</strong>.</p>

        ${
          resetUrl
            ? `
          <div style="margin-top: 16px;">
            <a href="${resetUrl}" style="display:inline-block; text-decoration:none; border: 1px solid #111; color:#111; padding: 10px 14px; border-radius: 10px; font-weight: 700;">
              Abrir enlace de recuperación
            </a>
            <div style="margin-top: 10px; font-size: 12px; color: #6b7280; word-break: break-all;">
              Si el botón no funciona, pega este enlace en tu navegador:<br/>
              <span>${resetUrl}</span>
            </div>
          </div>
        `
            : ""
        }

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;" />
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Si no solicitaste este cambio, ignora este correo.
        </p>
      </div>
    `,
  });
}

export async function sendEmailVerificationToken(to: string, token: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Código de verificación de correo",
    text:
      `VIOMAR\n\n` +
      `Código de verificación\n\n` +
      `Código: ${token}\n` +
      `Expira en 15 minutos.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.45;">
        <div style="text-align:center; margin: 12px 0 18px;">
          ${VIOMAR_STICKER_URL ? `<img src="${VIOMAR_STICKER_URL}" alt="VIOMAR" style="max-width: 160px; height: auto;" />` : ""}
        </div>

        <h2 style="margin: 0 0 10px; font-size: 18px;">Verifica tu correo</h2>
        <p style="margin: 0 0 12px;">Ingresa este código para confirmar tu correo:</p>

        <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; display: inline-block;">
          <div style="font-size: 14px; color: #374151; margin-bottom: 6px;">Código</div>
          <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px;">${token}</div>
        </div>

        <p style="margin: 12px 0 0; font-size: 13px; color: #374151;">Este código expira en <strong>15 minutos</strong>.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;" />
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Si no fuiste tú, ignora este correo.
        </p>
      </div>
    `,
  });
}
