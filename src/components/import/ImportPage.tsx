import React, { useState } from 'react';
import { useProducts } from '../../lib/products';
import { useServices } from '../../lib/services';
import { useCategories } from '../../lib/categories';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

type ImportType = 'products' | 'services';

interface ImportResult {
  success: number;
  errors: number;
  errorMessages: string[];
}

interface ColumnMapping {
  [key: string]: string;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
}

export function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('products');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  
  const { createProduct } = useProducts();
  const { createService } = useServices();
  const { categories, fetchCategories, findCategoryByName } = useCategories();

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const requiredFields = {
    products: ['name', 'price', 'category_id'],
    services: ['name', 'price', 'duration', 'category_id']
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as string[][];

          setPreviewData({ headers, rows });
          
          // Initialize column mapping with best guesses
          const initialMapping: ColumnMapping = {};
          headers.forEach((header, index) => {
            const normalizedHeader = header.toLowerCase().trim();
            if (normalizedHeader.includes('nome') || normalizedHeader.includes('name')) {
              initialMapping['name'] = header;
            } else if (normalizedHeader.includes('preço') || normalizedHeader.includes('price')) {
              initialMapping['price'] = header;
            } else if (normalizedHeader.includes('estoque') || normalizedHeader.includes('stock')) {
              initialMapping['stock_quantity'] = header;
            } else if (normalizedHeader.includes('duração') || normalizedHeader.includes('duration')) {
              initialMapping['duration'] = header;
            } else if (normalizedHeader.includes('categoria') || normalizedHeader.includes('category')) {
              initialMapping['category_id'] = header;
            }
          });
          setColumnMapping(initialMapping);
        } catch (err) {
          toast.error('Erro ao ler arquivo. Certifique-se que é um arquivo XLSX válido.');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error('Erro ao processar arquivo');
    }
  };

  const handleImport = async () => {
    if (!previewData) return;

    setIsImporting(true);
    setResult(null);

    const result: ImportResult = {
      success: 0,
      errors: 0,
      errorMessages: [],
    };

    try {
      const required = requiredFields[importType];
      const missingFields = required.filter(field => !columnMapping[field]);
      if (missingFields.length > 0) {
        throw new Error(`Campos obrigatórios não mapeados: ${missingFields.join(', ')}`);
      }

      for (const row of previewData.rows) {
        try {
          const rowData: Record<string, any> = {};
          Object.entries(columnMapping).forEach(([field, header]) => {
            const index = previewData.headers.indexOf(header);
            if (index !== -1) {
              rowData[field] = row[index];
            }
          });

          // Find category ID based on name
          const categoryName = rowData.category_id;
          const category = findCategoryByName(categoryName, importType);
          
          if (!category) {
            throw new Error(`Categoria não encontrada: ${categoryName}`);
          }
          rowData.category_id = category.id;

          if (importType === 'products') {
            await createProduct({
              name: rowData.name,
              price: parseFloat(rowData.price),
              stock_quantity: rowData.stock_quantity ? parseInt(rowData.stock_quantity, 10) : 0,
              category_id: rowData.category_id,
              active: true,
            });
          } else {
            await createService({
              name: rowData.name,
              price: parseFloat(rowData.price),
              duration: rowData.duration,
              category_id: rowData.category_id,
              active: true,
            });
          }
          result.success++;
        } catch (error) {
          result.errors++;
          result.errorMessages.push(
            error instanceof Error ? error.message : 'Erro desconhecido'
          );
        }
      }

      setResult(result);
      toast.success(`Importação concluída: ${result.success} registros importados com sucesso`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar arquivo');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Importação de Dados</h2>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label className="text-base font-medium text-gray-900">Tipo de Importação</label>
            <p className="text-sm text-gray-500">Selecione o tipo de dados que deseja importar</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center">
                <input
                  id="products"
                  name="import-type"
                  type="radio"
                  checked={importType === 'products'}
                  onChange={() => setImportType('products')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="products" className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Produtos</span>
                  <span className="block text-sm text-gray-500">
                    Campos necessários: Nome, Preço, Categoria
                  </span>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="services"
                  name="import-type"
                  type="radio"
                  checked={importType === 'services'}
                  onChange={() => setImportType('services')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="services" className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Serviços</span>
                  <span className="block text-sm text-gray-500">
                    Campos necessários: Nome, Preço, Duração (HH:mm), Categoria
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700">
              Arquivo XLSX
            </label>
            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Selecione um arquivo</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".xlsx"
                      className="sr-only"
                      onChange={handleFileUpload}
                      disabled={isImporting}
                    />
                  </label>
                  <p className="pl-1">ou arraste e solte</p>
                </div>
                <p className="text-xs text-gray-500">XLSX até 10MB</p>
              </div>
            </div>
          </div>

          {previewData && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Mapeamento de Colunas</h3>
              <div className="space-y-4">
                {requiredFields[importType].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700">
                      {field === 'name' ? 'Nome' :
                       field === 'price' ? 'Preço' :
                       field === 'stock_quantity' ? 'Estoque' :
                       field === 'duration' ? 'Duração' :
                       field === 'category_id' ? 'Categoria' : field}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({
                        ...columnMapping,
                        [field]: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="">Selecione a coluna</option>
                      {previewData.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {importType === 'products' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estoque (opcional)
                    </label>
                    <select
                      value={columnMapping['stock_quantity'] || ''}
                      onChange={(e) => setColumnMapping({
                        ...columnMapping,
                        stock_quantity: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="">Selecione a coluna</option>
                      {previewData.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {isImporting ? 'Importando...' : 'Importar Dados'}
                </button>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900">Prévia dos Dados</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {previewData.headers.map((header) => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.rows.length > 5 && (
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      Mostrando 5 de {previewData.rows.length} linhas
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900">Resultado da Importação</h3>
              
              <div className="mt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-900">
                    {result.success} registros importados com sucesso
                  </span>
                </div>

                {result.errors > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-gray-900">
                        {result.errors} erros durante a importação
                      </span>
                    </div>

                    <div className="bg-red-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Detalhes dos erros:
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {result.errorMessages.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Instruções</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Formato do arquivo para Produtos:</h4>
            <pre className="mt-2 p-4 bg-gray-50 rounded-md text-sm overflow-x-auto">
              Nome,Preço,Estoque,Categoria{'\n'}
              Shampoo Anticaspa,29.90,50,Shampoos{'\n'}
              Pomada Modeladora,45.00,30,Pomadas{'\n'}
              Óleo para Barba,35.90,25,Óleos
            </pre>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900">Formato do arquivo para Serviços:</h4>
            <pre className="mt-2 p-4 bg-gray-50 rounded-md text-sm overflow-x-auto">
              Nome,Preço,Duração,Categoria{'\n'}
              Corte Masculino,50.00,00:30,Barbearia{'\n'}
              Barba,40.00,00:45,Barbearia{'\n'}
              Limpeza de Pele,80.00,01:00,Estética
            </pre>
          </div>

          <div className="prose prose-sm text-gray-500">
            <p>Observações importantes:</p>
            <ul>
              <li>O arquivo deve estar no formato XLSX (Excel)</li>
              <li>A primeira linha deve conter os nomes das colunas</li>
              <li>Preços devem usar ponto como separador decimal</li>
              <li>Duração deve estar no formato HH:mm (ex: 00:30 para 30 minutos)</li>
              <li>Categorias devem existir no sistema</li>
              <li>Campos vazios serão considerados como nulos</li>
              <li>O campo Estoque é opcional para produtos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}