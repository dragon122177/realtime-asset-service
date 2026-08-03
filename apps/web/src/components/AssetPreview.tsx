import { AlertTriangle, Box, LoaderCircle, Maximize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Box3,
  Color,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { api } from '../lib/api';

export function AssetPreview({
  assetId,
  kind,
  compact = false,
}: {
  assetId: string;
  kind: 'source' | 'delivery';
  compact?: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let cancelled = false;
    let frame = 0;
    const scene = new Scene();
    scene.background = new Color('#0b1020');
    const camera = new PerspectiveCamera(42, 1, 0.01, 1000);
    camera.position.set(4, 3, 5);
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setState('error');
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = !compact;
    controls.autoRotateSpeed = 0.65;
    controls.minDistance = 1;
    controls.maxDistance = 30;
    scene.add(new HemisphereLight('#e8f1ff', '#18213e', 2.6));
    const grid = new GridHelper(12, 24, '#303b68', '#171f39');
    grid.position.y = -1.35;
    scene.add(grid);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    void api
      .downloadAsset(assetId, kind)
      .then((data) => {
        if (cancelled) return;
        new GLTFLoader().parse(
          data,
          '',
          (gltf) => {
            if (cancelled) return;
            scene.add(gltf.scene);
            const bounds = new Box3().setFromObject(gltf.scene);
            const center = bounds.getCenter(new Vector3());
            const size = bounds.getSize(new Vector3());
            const radius = Math.max(size.x, size.y, size.z, 1);
            controls.target.copy(center);
            camera.position
              .copy(center)
              .add(new Vector3(radius * 1.6, radius * 1.15, radius * 1.8));
            camera.near = Math.max(radius / 100, 0.01);
            camera.far = radius * 100;
            camera.updateProjectionMatrix();
            grid.position.y = bounds.min.y - radius * 0.04;
            setState('ready');
          },
          () => setState('error'),
        );
      })
      .catch(() => setState('error'));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [assetId, compact, kind]);

  return (
    <div className={`asset-preview ${compact ? 'preview-compact' : ''}`}>
      <div ref={mount} className="preview-canvas" />
      {state === 'loading' && (
        <div className="preview-state">
          <LoaderCircle className="spin" />
          <span>Preparing realtime preview</span>
        </div>
      )}
      {state === 'error' && (
        <div className="preview-state preview-error">
          <AlertTriangle />
          <span>Preview unavailable</span>
          <small>The source can still be reviewed through its metrics.</small>
        </div>
      )}
      <div className="preview-overlay">
        <span>
          <Box size={14} /> {kind === 'delivery' ? 'Delivery candidate' : 'Source asset'}
        </span>
        <span>
          <Maximize2 size={14} /> Drag to orbit
        </span>
      </div>
    </div>
  );
}
