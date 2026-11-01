import { useEffect, useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { Button, Dialog } from '../components/ui';
export function ImageImportChoice({
  file,
  onAI,
  onLocal,
  onClose,
}: {
  file: File | null;
  onAI: (file: File) => void;
  onLocal: (file: File) => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const localSupported = file && !/\.webp$/i.test(file.name) && file.size <= 5 * 1024 * 1024;
  return (
    <Dialog open={Boolean(file)} title="Reconstruct this image" onClose={onClose}>
      {file && (
        <>
          <img
            className="image-import-preview"
            src={preview}
            alt="Original image selected for import"
          />
          <p>
            <strong>{file.name}</strong>
          </p>
          <p>
            Use AI to understand components, groups and connections, then create an editable
            diagram. Choose the format and authorize processing on the next screen.
          </p>
          <p className="fine-print">
            Your image stays on this device until you authorize upload. AI processing uses the
            configured allowance.
          </p>
          <div className="import-choice-actions">
            <Button variant="primary" icon={Sparkles} onClick={() => onAI(file)}>
              Reconstruct with AI
            </Button>
            <Button icon={FileText} disabled={!localSupported} onClick={() => onLocal(file)}>
              Extract text locally
            </Button>
          </div>
          <p className="fine-print">
            Local OCR reads text only. It cannot understand this image's structure or detect its
            arrows. Local extraction supports PNG/JPEG up to 5 MB.
          </p>
        </>
      )}
    </Dialog>
  );
}
