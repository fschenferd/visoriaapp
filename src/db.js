import Dexie from 'dexie';

export const db = new Dexie('VistoriaAppDB');

db.version(1).stores({
  vistorias: '++id, endereco, data, tipo',
  fotos: '++id, vistoriaId, itemId'
});

export async function salvarFoto(file, vistoriaId, itemId) {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            db.fotos.add({
              vistoriaId,
              itemId,
              blob: blob,
              dataCriacao: new Date()
            }).then(resolve).catch(reject);
          } else {
            reject(new Error("Falha ao processar imagem"));
          }
        }, 'image/webp', 0.7);
      };
    };

    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
