import { useMutation, useQuery } from '@tanstack/react-query';
import { Box, CheckCircle2, FileBox, ShieldCheck, UploadCloud, Workflow } from 'lucide-react';
import { type DragEvent, type FormEvent, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useRouter } from '../context/RouterContext';
import { api } from '../lib/api';
import { formatBytes } from '../lib/format';

export function UploadPage() {
  const { navigate } = useRouter();
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [dragging, setDragging] = useState(false);
  const mutation = useMutation({
    mutationFn: api.upload,
    onSuccess: ({ asset }) => navigate(`/assets/${asset.id}`),
  });
  const choose = (next: File | undefined) => {
    if (!next) return;
    setFile(next);
    if (!name) setName(next.name.replace(/\.(gltf|glb)$/i, ''));
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (file && projectId) mutation.mutate({ file, projectId, name, tags });
  };
  return (
    <>
      <PageHeader
        eyebrow="Controlled ingestion"
        title="Add a 3D asset"
        description="Upload a self-contained glTF 2.0 source. ForgeFlow will hash, analyze and route it through quality review."
      />
      <form className="upload-layout" onSubmit={submit}>
        <section className="panel upload-main">
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".gltf,.glb,model/gltf+json,model/gltf-binary"
              onChange={(event) => choose(event.target.files?.[0])}
              hidden
            />
            {file ? (
              <>
                <span className="file-orbit">
                  <FileBox />
                </span>
                <strong>{file.name}</strong>
                <p>{formatBytes(file.size)} · ready for validation</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => inputRef.current?.click()}
                >
                  Choose a different file
                </button>
              </>
            ) : (
              <>
                <span className="upload-orbit">
                  <UploadCloud />
                </span>
                <strong>Drop a glTF or GLB file here</strong>
                <p>Self-contained glTF 2.0 · maximum 50 MB</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => inputRef.current?.click()}
                >
                  Browse files
                </button>
              </>
            )}
          </div>
          <div className="form-grid">
            <label>
              Destination project
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                required
              >
                <option value="">Select a project</option>
                {projects.data?.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Display name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
                placeholder="Product hero model"
                required
              />
            </label>
            <label className="full-field">
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="web, configurator, release-2026"
              />
              <small>Comma-separated; used for operational filtering.</small>
            </label>
          </div>
          {mutation.error && <div className="form-error">{mutation.error.message}</div>}
          <div className="upload-actions">
            <span>
              Your source is preserved unchanged; delivery output receives a separate version.
            </span>
            <button className="primary-button" disabled={!file || !projectId || mutation.isPending}>
              {mutation.isPending ? 'Ingesting asset…' : 'Start processing'} <Workflow size={17} />
            </button>
          </div>
        </section>
        <aside className="upload-sidebar">
          <article className="panel guardrail-card">
            <div className="guardrail-icon">
              <ShieldCheck />
            </div>
            <h3>Preflight guardrails</h3>
            <ul>
              <li>
                <CheckCircle2 /> glTF 2.0 structure
              </li>
              <li>
                <CheckCircle2 /> SHA-256 deduplication
              </li>
              <li>
                <CheckCircle2 /> Embedded resource policy
              </li>
              <li>
                <CheckCircle2 /> File-size enforcement
              </li>
            </ul>
          </article>
          <article className="panel pipeline-explainer">
            <h3>What happens next</h3>
            {[
              ['01', 'Ingest', 'The immutable source is stored by hash.'],
              ['02', 'Analyze', 'A worker measures geometry and packaging.'],
              ['03', 'Review', 'A human evaluates warnings and preview.'],
              ['04', 'Publish', 'Only an approved version becomes delivery-ready.'],
            ].map(([number, title, copy]) => (
              <div key={number}>
                <span>{number}</span>
                <p>
                  <strong>{title}</strong>
                  <small>{copy}</small>
                </p>
              </div>
            ))}
          </article>
          <article className="compatibility-note">
            <Box />
            <p>
              <strong>Processor boundary</strong>
              <span>
                The local worker validates and packages. Production adapters can invoke
                glTF-Transform, Blender or a managed optimization service.
              </span>
            </p>
          </article>
        </aside>
      </form>
    </>
  );
}
