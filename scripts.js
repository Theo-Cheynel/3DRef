import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("board");
    let isPanning = false;
    let isDragging = false;
    let isResizing = false;
    let startX, startY, scrollLeft, scrollTop;
    let panButton;
    let currentStickyNote = null;

    // Function to expand the board if needed
    function expandBoard(x, y) {
        const boardRect = board.getBoundingClientRect();
        if (x > boardRect.right) {
            board.style.width = `${boardRect.width + 1000}px`;
        }
        if (y > boardRect.bottom) {
            board.style.height = `${boardRect.height + 1000}px`;
        }
    }

    // Create a sticky note element
    function createStickyNoteElement(x, y) {
        const stickyNote = document.createElement("div");
        stickyNote.className = "sticky-note";
        stickyNote.style.left = `${x}px`;
        stickyNote.style.top = `${y}px`;

        // Add delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.innerHTML = "✕";
        deleteBtn.addEventListener("click", () => {
            board.removeChild(stickyNote);
        });
        stickyNote.appendChild(deleteBtn);

        // Add load button
        const loadBtn = document.createElement("button");
        loadBtn.className = "load-btn";
        loadBtn.innerHTML = "Load";
        loadBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".obj,.mtl,.fbx,.glb,.gltf";
            input.multiple = true;
            input.addEventListener("change", (event) => {
                const files = event.target.files;
                if (files.length > 0) {
                    load3DModel(files, stickyNote.threeJsScene);
                    stickyNote.removeChild(loadBtn);
                }
            });
            input.click();
        });
        stickyNote.appendChild(loadBtn);

        // Add canvas container
        const canvasContainer = document.createElement("div");
        canvasContainer.className = "canvas-container";
        stickyNote.appendChild(canvasContainer);

        // Add resizer elements
        const resizers = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        resizers.forEach(pos => {
            const resizer = document.createElement("div");
            resizer.className = `resizer ${pos}`;
            stickyNote.appendChild(resizer);
            addResizingFunctionality(resizer, stickyNote);
        });

        // Add drag functionality
        addDragFunctionality(stickyNote);

        // Create a basic ThreeJS scene and store the scene object
        const { scene, renderer, camera } = createThreeJsScene(canvasContainer);
        stickyNote.threeJsScene = scene;
        stickyNote.renderer = renderer;
        stickyNote.camera = camera;

        return stickyNote;
    }

    // Create a sticky note with right click
    board.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const x = e.clientX + window.scrollX;
        const y = e.clientY + window.scrollY;
        expandBoard(x, y);

        const stickyNote = createStickyNoteElement(x - 75, y - 75);
        board.appendChild(stickyNote);
    });

    // Mousedown to start panning
    board.addEventListener("mousedown", (e) => {
        if ((e.button === 0 || e.button === 1) && !isResizing && !isDragging) {
            isPanning = true;
            panButton = e.button;
            board.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = window.scrollX;
            scrollTop = window.scrollY;
            e.preventDefault();
        }
    });

    // Mousemove to pan
    board.addEventListener("mousemove", (e) => {
        if (isPanning) {
            const x = e.clientX - startX;
            const y = e.clientY - startY;
            window.scrollTo(scrollLeft - x, scrollTop - y);
        }
    });

    // Mouseup to stop panning
    board.addEventListener("mouseup", (e) => {
        if (e.button === panButton) {
            isPanning = false;
            board.style.cursor = "grab";
        }
    });

    // Mouseleave to stop panning
    board.addEventListener("mouseleave", () => {
        isPanning = false;
        board.style.cursor = "grab";
    });

    // Prevent context menu on right-click
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    // Add resizing functionality to resizer
    function addResizingFunctionality(resizer, stickyNote) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;

            const initialWidth = stickyNote.offsetWidth;
            const initialHeight = stickyNote.offsetHeight;
            const initialX = e.clientX;
            const initialY = e.clientY;
            const initialLeft = stickyNote.offsetLeft;
            const initialTop = stickyNote.offsetTop;

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);

            function resize(e) {
                if (isResizing) {
                    const dx = e.clientX - initialX;
                    const dy = e.clientY - initialY;

                    if (resizer.classList.contains('bottom-right')) {
                        stickyNote.style.width = `${initialWidth + dx}px`;
                        stickyNote.style.height = `${initialHeight + dy}px`;
                    } else if (resizer.classList.contains('bottom-left')) {
                        stickyNote.style.width = `${initialWidth - dx}px`;
                        stickyNote.style.height = `${initialHeight + dy}px`;
                        stickyNote.style.left = `${initialLeft + dx}px`;
                    } else if (resizer.classList.contains('top-right')) {
                        stickyNote.style.width = `${initialWidth + dx}px`;
                        stickyNote.style.height = `${initialHeight - dy}px`;
                        stickyNote.style.top = `${initialTop + dy}px`;
                    } else if (resizer.classList.contains('top-left')) {
                        stickyNote.style.width = `${initialWidth - dx}px`;
                        stickyNote.style.height = `${initialHeight - dy}px`;
                        stickyNote.style.left = `${initialLeft + dx}px`;
                        stickyNote.style.top = `${initialTop + dy}px`;
                    }

                    stickyNote.renderer.setSize(stickyNote.clientWidth, stickyNote.clientHeight);
                    stickyNote.camera.aspect = stickyNote.clientWidth / stickyNote.clientHeight;
                    stickyNote.camera.updateProjectionMatrix();

                    expandBoard(stickyNote.getBoundingClientRect().right, stickyNote.getBoundingClientRect().bottom);
                }
            }

            function stopResize() {
                isResizing = false;
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        });
    }

    // Add drag functionality to sticky note
    function addDragFunctionality(stickyNote) {
        stickyNote.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resizer') || e.target.classList.contains('delete-btn')) {
                return;
            }

            e.preventDefault();
            isDragging = true;
            currentStickyNote = stickyNote;

            startX = e.clientX;
            startY = e.clientY;
            const initialLeft = stickyNote.offsetLeft;
            const initialTop = stickyNote.offsetTop;

            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);

            function drag(e) {
                if (isDragging) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    stickyNote.style.left = `${initialLeft + dx}px`;
                    stickyNote.style.top = `${initialTop + dy}px`;

                    expandBoard(stickyNote.getBoundingClientRect().right, stickyNote.getBoundingClientRect().bottom);
                }
            }

            function stopDrag() {
                isDragging = false;
                currentStickyNote = null;
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', stopDrag);
            }
        });
    }

    function createThreeJsScene(container) {
        const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 1, 1000);
        camera.position.z = 400;

        const scene = new THREE.Scene();
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0xffffff, 1);
        container.appendChild(renderer.domElement);

        container.addEventListener('mousedown', (e) => e.stopPropagation());
        container.addEventListener('mouseup', (e) => e.stopPropagation());
        container.addEventListener('mousemove', (e) => e.stopPropagation());
        container.addEventListener('mousedown', (e) => e.stopPropagation());
        container.addEventListener('contextmenu', (e) => e.stopPropagation());

        const controls = new OrbitControls(camera, renderer.domElement);

        window.addEventListener('resize', () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        return { scene, camera, renderer, controls };
    }

    function load3DModel(files, scene) {
        for (const file of files) {
            const extension = file.name.split('.').pop().toLowerCase();
            let loader;

            if (extension === 'obj') {
                loader = new OBJLoader();
            } else if (extension === 'fbx') {
                loader = new FBXLoader();
            } else if (extension === 'glb' || extension === 'gltf') {
                loader = new GLTFLoader();
            }

            if (loader) {
                const reader = new FileReader();

                reader.onload = function(event) {
                    const contents = event.target.result;
                    console.log(`Loaded file contents:`, contents);

                    if (extension === 'obj' || extension === 'fbx') {
                        // For obj and fbx, contents should be a string
                        const object = loader.parse(contents);
                        console.log('Parsed object:', object);

                        object.scale.set(10, 10, 10); // Adjust scale as needed
                        object.position.set(0, 0, 0); // Adjust position as needed
                        scene.add(object);

                    } else if (extension === 'glb' || extension === 'gltf') {
                        // For glb and gltf, contents should be an ArrayBuffer
                        loader.parse(contents, '', function(gltf) {
                            const object = gltf.scene;
                            console.log('Parsed GLTF scene:', object);

                            object.scale.set(10, 10, 10); // Adjust scale as needed
                            object.position.set(0, 0, 0); // Adjust position as needed
                            scene.add(object);
                        });
                    }
                    // Ensure the renderer updates after adding the object
                    renderer.render(scene, camera);
                };

                // Read file based on its extension
                if (extension === 'obj' || extension === 'fbx') {
                    reader.readAsText(file); // Use readAsText for obj and fbx files
                } else if (extension === 'glb' || extension === 'gltf') {
                    reader.readAsArrayBuffer(file); // Use readAsArrayBuffer for glb and gltf files
                }
            }
        }
    }
});
