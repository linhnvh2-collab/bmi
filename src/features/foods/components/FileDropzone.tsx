import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileUp } from 'lucide-react';

interface FileDropzoneProps {
  onFileLoaded: (fileName: string, content: string) => void;
  accept?: string;
}

export function FileDropzone({
  onFileLoaded,
  accept = '.json,.csv',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const readFile = (file: File) => {
    setSelectedName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      onFileLoaded(file.name, text);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readFile(file);
    }
    event.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        isDragging
          ? 'border-forest-700 bg-forest-50/70'
          : 'border-slate-300 bg-slate-50/60 hover:border-forest-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
        id="food-import-file-input"
      />
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-forest-700">
        <FileUp className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-900">
        Kéo thả tệp JSON hoặc CSV vào đây
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {selectedName
          ? `Đã chọn: ${selectedName}`
          : 'Mỗi dòng sẽ được kiểm tra hợp lệ trước khi cho phép nhập vào Firestore.'}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 cursor-pointer"
      >
        Chọn tệp từ máy tính
      </button>
    </div>
  );
}
