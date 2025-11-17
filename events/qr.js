import qrcode from 'qrcode-terminal';

export default {
  name: 'qr',
  once: false,
  execute(bot, qr) {
    console.log('\n📲 Pindai kode QR ini dengan WhatsApp Anda:');
    console.log('═══════════════════════════════════════\n');
    qrcode.generate(qr, { small: true });
    console.log('\n═══════════════════════════════════════');
    console.log('⏳ Menunggu autentikasi...\n');
  }
};
