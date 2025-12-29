/**
 * Gera um link direto para o WhatsApp com mensagem pré-preenchida
 */
export function generateWhatsAppLink(
  phone: string,
  candidateName: string
): string {
  // Remove caracteres não numéricos do telefone
  const cleanPhone = phone.replace(/\D/g, '');

  // Adiciona código do país se não tiver (assume Brasil)
  const phoneWithCountry = cleanPhone.startsWith('55')
    ? cleanPhone
    : `55${cleanPhone}`;

  const message = encodeURIComponent(
    `Olá ${candidateName}! Vi sua candidatura para a Voidr e gostaria de conversar sobre a oportunidade.`
  );

  return `https://wa.me/${phoneWithCountry}?text=${message}`;
}
