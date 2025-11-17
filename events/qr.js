import qrcode from 'qrcode-terminal';

export default {
  name: 'qr',
  once: false,
  execute(bot, qr) {
    console.log('\n📲 Scan this QR code with your WhatsApp:');
    console.log('═══════════════════════════════════════\n');
    qrcode.generate(qr, { small: true });
    console.log('\n═══════════════════════════════════════');
    console.log('⏳ Waiting for authentication...\n');
  }
};
