import { useState, useEffect } from 'react';
import { db, salvarFoto } from './db';

function App() {
  const [tela, setTela] = useState('lista');
  const [vistorias, setVistorias] = useState([]);
  const [vistoriaAtual, setVistoriaAtual] = useState(null);
  const [fotosCache, setFotosCache] = useState({});
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [erro, setErro] = useState(null);
  const [progressoFotos, setProgressoFotos] = useState(0);

  // Carregar lista inicial
  useEffect(() => { carregarVistorias(); }, []);

  const carregarVistorias = async () => {
    try {
      const lista = await db.vistorias.toArray();
      setVistorias(lista.reverse());
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar dados.");
    }
  };

  // Função crucial: Pré-carregar TODAS as fotos de um item antes de mostrar
  const carregarTodasFotosItem = async (vistoriaId, itemId) => {
    const cacheKey = `${vistoriaId}_${itemId}`;
    if (fotosCache[cacheKey]) return fotosCache[cacheKey];

    const fotos = await db.fotos.where({ vistoriaId, itemId }).toArray();
    
    // Converter blobs em URLs de objeto
    const urls = fotos.map(foto => ({
      id: foto.id,
      url: URL.createObjectURL(foto.blob)
    }));

    setFotosCache(prev => ({ ...prev, [cacheKey]: urls }));
    return urls;
  };

  const novaVistoria = () => {
    setVistoriaAtual({
      id: Date.now(),
      endereco: '',
      data: new Date().toISOString().split('T')[0],
      tipo: 'entrada',
      responsavel: '',
      itens: []
    });
    setTela('form');
  };

  const salvarVistoria = async () => {
    if (!vistoriaAtual.endereco.trim()) {
      alert('Por favor, digite o endereço do imóvel.');
      return;
    }
    try {
      await db.vistorias.put(vistoriaAtual);
      alert('Vistoria salva com sucesso!');
      await carregarVistorias();
      setTela('lista');
      setVistoriaAtual(null);
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const adicionarItem = () => {
    setVistoriaAtual(prev => ({
      ...prev,
      itens: [...prev.itens, { id: Date.now(), comodo: '', descricao: '', estado: 'bom' }]
    }));
  };

  const removerItem = (idItem) => {
    setVistoriaAtual(prev => ({
      ...prev,
      itens: prev.itens.filter(i => i.id !== idItem)
    }));
  };

  const atualizarItem = (idItem, campo, valor) => {
    setVistoriaAtual(prev => ({
      ...prev,
      itens: prev.itens.map(i => i.id === idItem ? { ...i, [campo]: valor } : i)
    }));
  };

  const handleFotoUpload = async (idItem, event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await salvarFoto(file, vistoriaAtual.id, idItem);
      // Atualiza cache localmente
      await carregarTodasFotosItem(vistoriaAtual.id, idItem);
    } catch (err) {
      alert('Erro ao carregar foto: ' + err.message);
    }
  };

  const excluirVistoria = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta vistoria?')) {
      await db.vistorias.delete(id);
      await db.fotos.where('vistoriaId').equals(id).delete();
      await carregarVistorias();
    }
  };

  const editarVistoria = async (v) => {
    setVistoriaAtual({ ...v });
    setTela('form');
    // Carrega fotos apenas se necessário na edição (opcional, para performance)
  };

  // --- LÓGICA DO RELATÓRIO COM PRÉ-CARREGAMENTO ---
  const prepararEImpressao = async () => {
    if (!vistoriaAtual) return;
    
    setLoadingRelatorio(true);
    setProgressoFotos(0);
    setErro(null);

    try {
      const totalItens = vistoriaAtual.itens.length;
      
      // Para cada item, carregamos as fotos
      for (let i = 0; i < totalItens; i++) {
        const item = vistoriaAtual.itens[i];
        await carregarTodasFotosItem(vistoriaAtual.id, item.id);
        setProgressoFotos(Math.round(((i + 1) / totalItens) * 100));
      }

      // Pequeno delay para garantir renderização do DOM
      setTimeout(() => {
        window.print();
        setLoadingRelatorio(false);
      }, 500);

    } catch (err) {
      console.error(err);
      setErro("Erro ao carregar fotos para o relatório.");
      setLoadingRelatorio(false);
    }
  };

  // ====== TELA: LISTA ======
  if (tela === 'lista') {
    if (erro && !vistorias.length) return <div className="p-8 text-center text-red-600">{erro}</div>;
    if (loadingRelatorio) return null; // Evita clique duplo

    return (
      <div className="min-h-screen pb-6 bg-gray-50 font-sans">
        <header className="bg-white shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center border-b border-gray-100">
          <h1 className="text-xl font-bold text-blue-700 tracking-tight">🏠 Vistorias</h1>
          <button onClick={novaVistoria} className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow transition-colors">
            + Nova
          </button>
        </header>

        <main className="p-4 space-y-3 max-w-lg mx-auto">
          {vistorias.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-6xl mb-4 opacity-50">🏠</div>
              <p className="font-medium">Nenhuma vistoria encontrada.</p>
              <p className="text-sm mt-1">Toque em "+ Nova" para começar</p>
            </div>
          )}

          {vistorias.map(v => (
            <div key={v.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-lg truncate leading-tight">{v.endereco}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{new Date(v.data).toLocaleDateString('pt-BR')}</span>
                    <span>•</span>
                    <span className={v.tipo === 'entrada' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                      {v.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">{v.itens.length} itens • {v.responsavel || 'Sem responsável'}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => { setVistoriaAtual(v); setTela('relatorio'); }} className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="Gerar Relatório">📄</button>
                  <button onClick={() => editarVistoria(v)} className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Editar">✏️</button>
                  <button onClick={() => excluirVistoria(v.id)} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Excluir">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  // ====== TELA: FORMULÁRIO ======
  if (tela === 'form' && vistoriaAtual) {
    return (
      <div className="min-h-screen pb-32 bg-gray-50 font-sans">
        <header className="bg-white p-4 shadow-sm sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setTela('lista')} className="text-gray-500 hover:text-gray-800 p-1 transition-colors text-xl">←</button>
          <h1 className="font-bold text-lg flex-1 truncate text-gray-800">{vistoriaAtual.endereco || 'Nova Vistoria'}</h1>
          <button onClick={salvarVistoria} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors">Salvar</button>
        </header>

        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* Dados Principais */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
              <input type="text" value={vistoriaAtual.endereco} onChange={e => setVistoriaAtual({ ...vistoriaAtual, endereco: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="Rua, número, bairro" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data</label>
                <input type="date" value={vistoriaAtual.data} onChange={e => setVistoriaAtual({ ...vistoriaAtual, data: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
                <select value={vistoriaAtual.tipo} onChange={e => setVistoriaAtual({ ...vistoriaAtual, tipo: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Responsável</label>
              <input type="text" value={vistoriaAtual.responsavel} onChange={e => setVistoriaAtual({ ...vistoriaAtual, responsavel: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nome do responsável" />
            </div>
          </div>

          {/* Lista de Itens */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-gray-800 text-lg">Itens ({vistoriaAtual.itens.length})</h2>
              <button onClick={adicionarItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition-colors">+ Item</button>
            </div>

            {vistoriaAtual.itens.length === 0 && (
              <p className="text-gray-400 text-center py-8 italic">Nenhum item adicionado ainda.</p>
            )}

            <div className="space-y-5">
              {vistoriaAtual.itens.map((item, idx) => (
                <div key={item.id} className="border border-gray-200 p-4 rounded-lg relative bg-gray-50/50">
                  <button onClick={() => removerItem(item.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors text-lg font-bold">×</button>
                  
                  <h3 className="font-semibold text-gray-700 mb-4 pr-6 text-base">Item {idx + 1}</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cômodo</label>
                      <input type="text" value={item.comodo} onChange={e => atualizarItem(item.id, 'comodo', e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Sala, Quarto 1" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
                      <textarea value={item.descricao} onChange={e => atualizarItem(item.id, 'descricao', e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows="2" placeholder="Descreva o estado..." />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Estado</label>
                      <select value={item.estado} onChange={e => atualizarItem(item.id, 'estado', e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="bom">✅ Bom</option>
                        <option value="regular">⚠️ Regular</option>
                        <option value="ruim">❌ Ruim</option>
                      </select>
                    </div>

                    {/* Fotos */}
                    <div className="pt-4 border-t border-gray-200">
                      <label className="block w-full bg-white border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 px-4 py-3 rounded-lg text-center cursor-pointer active:bg-gray-50 transition-all group">
                        <div className="flex flex-col items-center">
                          <span className="text-xl mb-1 group-hover:scale-110 transition-transform">📷</span>
                          <span className="text-sm font-medium">Adicionar Foto</span>
                          <span className="text-xs text-gray-400 mt-1">(Toque para abrir câmera ou galeria)</span>
                        </div>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFotoUpload(item.id, e)} />
                      </label>

                      {/* Cache de fotos carregadas */}
                      <PreviewFotos vistoriaId={vistoriaAtual.id} itemId={item.id} fotosCache={fotosCache} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
          <div className="max-w-lg mx-auto flex gap-3">
            <button onClick={() => setTela('lista')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors">Cancelar</button>
            <button onClick={salvarVistoria} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow transition-colors">💾 Salvar</button>
          </div>
        </div>
      </div>
    );
  }

  // ====== TELA: RELATÓRIO ======
  if (tela === 'relatorio' && vistoriaAtual) {
    const v = vistoriaAtual;
    const totalFotos = v.itens.reduce((acc, item) => acc + (fotosCache[`${v.id}_${item.id}`]?.length || 0), 0);

    return (
      <div className="min-h-screen bg-gray-100 font-sans">
        {/* Botões de Controle (Não Impressos) */}
        <div className="no-print flex justify-between items-center p-4 max-w-[800px] mx-auto sticky top-0 z-10 bg-gray-100/90 backdrop-blur-sm border-b border-gray-200">
          <button onClick={() => setTela('lista')} className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2">
            ← Voltar
          </button>
          
          {loadingRelatorio ? (
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-blue-700 animate-pulse">Carregando {progressoFotos}% das fotos...</span>
              <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progressoFotos}%` }}></div>
              </div>
            </div>
          ) : (
            <button 
              onClick={prepararEImpressao} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow font-bold text-lg transition-all transform active:scale-95 flex items-center gap-2"
            >
              🖨️ Salvar PDF / Imprimir
            </button>
          )}
        </div>

        {/* Área de Impressão */}
        <div id="print-area" className="bg-white max-w-[800px] mx-auto shadow-lg mt-4 mb-10 p-6 md:p-10 min-h-screen">
          
          {/* Header do Relatório com Espaço para Logo */}
          <div className="flex justify-between items-start mb-8 border-b-2 border-gray-100 pb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Relatório de Vistoria</h1>
              <p className="text-gray-500 text-sm">Documento gerado automaticamente</p>
            </div>
            
            {/* LOCAL PARA LOGO - Substitua 'seu-logo.png' pelo caminho da sua imagem quando tiver */}
            {/* Se não tiver imagem, pode apagar esta div inteira */}
                        <div className="w-20 h-20 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <img 
                src="/logo.jpg" 
                alt="Logo da Empresa" 
                className="max-w-full max-h-full object-contain" 
              />
            </div>
          </div>

          {/* Informações Gerais */}
          <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-blue-600 mb-10 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Endereço</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{v.endereco}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Data da Vistoria</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{new Date(v.data).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Tipo</p>
                <p className="text-lg font-bold text-gray-800 mt-1 capitalize">{v.tipo}</p>
              </div>
              {v.responsavel && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Responsável</p>
                  <p className="text-lg font-bold text-gray-800 mt-1">{v.responsavel}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
              Total de itens registrados: <strong>{v.itens.length}</strong> • Fotos associadas: <strong>{totalFotos}</strong>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-6">🏠 Itens Vistoriados</h2>

          {v.itens.length === 0 ? (
            <p className="text-gray-500 text-center py-12 italic">Nenhum item registrado nesta vistoria.</p>
          ) : (
            v.itens.map((item, idx) => {
              const cacheKey = `${v.id}_${item.id}`;
              const fotos = fotosCache[cacheKey] || [];
              
              return (
                <div key={idx} className="mb-8 border border-gray-200 rounded-xl overflow-hidden break-inside-avoid shadow-sm">
                  {/* Cabeçalho do Item */}
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Item {idx + 1}: {item.comodo || 'Sem identificação'}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      item.estado === 'bom' ? 'bg-green-100 text-green-800' :
                      item.estado === 'regular' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.estado}
                    </span>
                  </div>

                  {/* Corpo do Item */}
                  <div className="p-5">
                    {item.descricao && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 uppercase font-bold tracking-wide mb-1">Observações</p>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{item.descricao}</p>
                      </div>
                    )}

                    {/* Galeria de Fotos */}
                    {fotos.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-500 uppercase font-bold tracking-wide mb-3">Registro Fotográfico ({fotos.length})</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {fotos.map(f => (
                            <div key={f.id} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img src={f.url} alt="Foto vistoria" className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic mt-2">Nenhuma foto anexada a este item.</p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Rodapé do Relatório */}
          <div className="mt-16 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400 mb-1">Este relatório foi gerado automaticamente pelo aplicativo.</p>
            <p className="text-xs text-gray-400">Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <div className="mt-8 flex justify-center gap-12">
              <div className="w-40 border-t border-gray-400 pt-2">
                <p className="text-xs text-gray-500 text-center">Assinatura Responsável</p>
              </div>
              <div className="w-40 border-t border-gray-400 pt-2">
                <p className="text-xs text-gray-500 text-center">Assinatura Inquilino/Proprietário</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// Componente auxiliar para pré-visualizar fotos no formulário
function PreviewFotos({ vistoriaId, itemId, fotosCache }) {
  const cacheKey = `${vistoriaId}_${itemId}`;
  const fotos = fotosCache[cacheKey] || [];

  if (fotos.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        {fotos.map(f => (
          <img key={f.id} src={f.url} alt="Prévia" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
        ))}
      </div>
      <p className="text-xs text-center text-gray-400 mt-1">{fotos.length} foto(s) carregada(s)</p>
    </div>
  );
}

export default App;
