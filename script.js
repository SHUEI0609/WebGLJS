// script.js (完成版)

// ページの読み込み完了時にすべての初期化処理を実行
document.addEventListener('DOMContentLoaded', function() {
    
    // UI機能の初期化
    initCopyButtons();
    initSmoothScroll();
    initSectionAnimations();
    initCollapsibleCode();

    // インタラクティブな三角形デモの初期化
    initInteractiveTriangleDemo();
    
    // 発展デモのコードを折りたたみセクションに表示
    displayWebGLDemoCode();
});


/**
 * webgl-demo.jsのコードを文字列として保持
 * fetch()を使わず直接埋め込むことで、ローカルファイルでのエラーを回避
 */
const webglDemoCodeString = `// webgl-demo.js
document.addEventListener('DOMContentLoaded', function() {
    if (typeof mat4 === 'undefined') {
        console.error('gl-matrixライブラリが読み込まれていません');
        return;
    }

    const canvas = document.getElementById('glcanvas');
    if (!canvas) {
        console.error('WebGLキャンバスが見つかりません');
        return;
    }

    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGLを初期化できません。');
        return;
    }

    // --- インタラクティブ操作用パラメータ ---
    let rotationSpeed = 1.0;
    let cameraDistance = 6.0;
    let catColor = [0.2, 0.2, 0.2, 1.0]; // 初期色 (黒に近いグレー)

    // UI要素の取得とイベントリスナーの設定
    const rotationSlider = document.getElementById('rotation-speed-slider');
    const zoomSlider = document.getElementById('zoom-slider');
    const colorPicker = document.getElementById('cat-color-picker');

    if (rotationSlider) {
        rotationSlider.addEventListener('input', e => { rotationSpeed = parseFloat(e.target.value); });
    }
    if (zoomSlider) {
        zoomSlider.addEventListener('input', e => { cameraDistance = parseFloat(e.target.value); });
    }
    if(colorPicker) {
        colorPicker.addEventListener('input', e => {
            const hex = e.target.value;
            catColor = [
                parseInt(hex.substring(1, 3), 16) / 255,
                parseInt(hex.substring(3, 5), 16) / 255,
                parseInt(hex.substring(5, 7), 16) / 255,
                1.0
            ];
        });
    }

    const vsSource = \`
        attribute vec3 aVertexPosition;
        uniform mat4 uMvpMatrix;
        void main(void) {
            gl_Position = uMvpMatrix * vec4(aVertexPosition, 1.0);
        }
    \`;

    const fsSource = \`
        precision mediump float;
        uniform vec4 uColor;
        void main(void) {
            gl_FragColor = uColor;
        }
    \`;
    
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            mvpMatrix: gl.getUniformLocation(shaderProgram, 'uMvpMatrix'),
            color: gl.getUniformLocation(shaderProgram, 'uColor'),
        },
    };

    const buffers = initBuffers(gl);
    
    let catRotation = 0.0;
    let then = 0;
    function render(now) {
        now *= 0.001;
        const deltaTime = now - then;
        then = now;

        drawScene(gl, programInfo, buffers, catRotation, cameraDistance, catColor);
        catRotation += deltaTime * rotationSpeed;

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
});


function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('シェーダープログラムのリンク失敗: ' + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('シェーダーのコンパイル失敗: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initBuffers(gl) {
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const positions = [
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
        -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    const indices = [
        0, 1, 2, 0, 2, 3, // Front
        4, 5, 6, 4, 6, 7, // Back
        3, 2, 6, 3, 6, 5, // Top
        4, 7, 1, 4, 1, 0, // Bottom
        4, 0, 3, 4, 3, 5, // Left
        1, 7, 6, 1, 6, 2, // Right
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return { vertex: vertexBuffer, index: indexBuffer };
}

function drawScene(gl, programInfo, buffers, rotation, cameraDist, color) {
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = 45 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [0, 1.5, cameraDist], [0, 0, 0], [0, 1, 0]);

    const catMatrix = mat4.create();
    mat4.rotate(catMatrix, catMatrix, rotation, [0, 1, 0]);

    // --- 各パーツの描画 ---
    const drawPart = (pos, scale) => drawCube(gl, programInfo, buffers, projectionMatrix, viewMatrix, catMatrix, pos, scale, color);
    drawPart([0.0, 0.0, 0.0], [1.5, 0.8, 0.8]);  // 体
    drawPart([1.0, 0.6, 0.0], [0.7, 0.7, 0.7]);  // 頭
    drawPart([0.5, -0.6, 0.2], [0.3, 0.5, 0.3]); // 足1
    drawPart([-0.5, -0.6, 0.2], [0.3, 0.5, 0.3]);// 足2
    drawPart([0.5, -0.6, -0.2], [0.3, 0.5, 0.3]);// 足3
    drawPart([-0.5, -0.6, -0.2], [0.3, 0.5, 0.3]);// 足4
    drawPart([-1.0, 0.4, 0.0], [0.8, 0.2, 0.2]); // しっぽ
}

function drawCube(gl, programInfo, buffers, projectionMatrix, viewMatrix, parentMatrix, position, scale, color) {
    const modelMatrix = mat4.create();
    mat4.multiply(modelMatrix, parentMatrix, modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, position);
    mat4.scale(modelMatrix, modelMatrix, scale);

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(programInfo.uniformLocations.mvpMatrix, false, mvpMatrix);
    gl.uniform4fv(programInfo.uniformLocations.color, color);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}
`;


/**
 * クリップボードにテキストをコピーするヘルパー関数
 */
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'コピー完了!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }, (err) => {
        console.error('コピーに失敗しました', err);
        alert('コピーに失敗しました。');
    });
}

/**
 * すべてのコードブロックにコピーボタンをセットアップする
 */
function initCopyButtons() {
    document.querySelectorAll('.code-cell').forEach(cell => {
        const code = cell.querySelector('code');
        if (!code || cell.querySelector('.copy-button')) return;

        const button = document.createElement('button');
        button.textContent = 'コピー';
        button.className = 'copy-button';
        
        button.addEventListener('click', () => {
            copyToClipboard(code.innerText, button);
        });
        cell.appendChild(button);
    });
}

/**
 * ナビゲーションのスムーススクロールを有効にする
 */
function initSmoothScroll() {
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

/**
 * セクションが画面内に入った時にフェードインさせる
 */
function initSectionAnimations() {
    const sections = document.querySelectorAll('main section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        observer.observe(section);
    });
}

/**
 * 折りたたみコードブロックの機能を有効にする
 */
function initCollapsibleCode() {
    const collapsibles = document.querySelectorAll('.collapsible-code');
    collapsibles.forEach(collapsible => {
        const button = collapsible.querySelector('.toggle-button');
        const content = collapsible.querySelector('.code-content');
        if (!button || !content) return;

        button.addEventListener('click', () => {
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            button.querySelector('.arrow').textContent = isVisible ? '▼' : '▲';
            button.querySelector('.button-text').textContent = isVisible ? '3D猫のコードを表示する' : 'コードを隠す';
        });
    });
}

/**
 * インタラクティブな三角形デモを初期化・実行する
 */
function initInteractiveTriangleDemo() {
    // --- HTML要素の取得 ---
    const canvas = document.getElementById('interactive-triangle-canvas');
    const vsEditor = document.getElementById('vs-editor');
    const fsEditor = document.getElementById('fs-editor');
    const updateBtn = document.getElementById('update-shader-btn');
    const resetBtn = document.getElementById('reset-shader-btn');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const scaleSlider = document.getElementById('triangle-scale-slider');
    const rotationSlider = document.getElementById('triangle-rotation-slider');

    if (!canvas || !vsEditor || !fsEditor || !updateBtn || !resetBtn || !scaleSlider || !rotationSlider) {
        return;
    }

    // --- 初期コードの保存（リセット用）---
    const initialVsCode = vsEditor.value;
    const initialFsCode = fsEditor.value;

    // --- WebGLの初期化 ---
    const gl = canvas.getContext('webgl');
    if (!gl) {
        alert('お使いのブラウザはWebGLに対応していないようです。');
        return;
    }

    // --- 変数の準備 ---
    let shaderProgram;
    let positionBuffer;
    let uTransformMatrixLocation; // シェーダー内の変数(uniform)の場所

    // スライダーで操作するための状態変数
    let triangleScale = 1.0;
    let triangleRotationSpeed = 0.0;
    let currentRotationAngle = 0.0; // 現在の回転角度
    let lastTime = 0; // 前フレームからの経過時間計算用

    // --- シェーダー関連のヘルパー関数 ---
    function loadShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('シェーダーのコンパイルに失敗しました:\n' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function initShaderProgram(vsSource, fsSource) {
        const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);
        if (!vertexShader || !fragmentShader) return null;
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            alert('シェーダープログラムのリンクに失敗しました:\n' + gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    // シェーダーを再コンパイルして、変数の場所を再取得する関数
    function compileShaders() {
        const newProgram = initShaderProgram(vsEditor.value, fsEditor.value);
        if (newProgram) {
            shaderProgram = newProgram;
            // 新しいプログラム内の uniform 変数の場所を取得
            uTransformMatrixLocation = gl.getUniformLocation(shaderProgram, 'uTransformMatrix');
        }
    }

    // --- 頂点データの初期化 ---
    function initBuffers() {
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [ 0.0, 0.5, -0.5, -0.5, 0.5, -0.5 ]; // Y軸を中心に調整
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }
    
    // --- メインのアニメーションループ ---
    function render(now) {
        now *= 0.001; // 時間を秒に変換
        const deltaTime = now - lastTime;
        lastTime = now;

        if (shaderProgram) {
            // --- 背景色の設定 ---
            const hex = bgColorPicker.value;
            const r = parseInt(hex.substring(1, 3), 16) / 255;
            const g = parseInt(hex.substring(3, 5), 16) / 255;
            const b = parseInt(hex.substring(5, 7), 16) / 255;
            gl.clearColor(r, g, b, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // --- 行列計算 ---
            // 1. 状態の更新 (回転角度)
            currentRotationAngle += deltaTime * triangleRotationSpeed;

            // 2. 変換行列の作成
            const transformMatrix = mat4.create(); // 単位行列を作成
            // Z軸を中心に回転させる
            mat4.rotate(transformMatrix, transformMatrix, currentRotationAngle, [0, 0, 1]); 
            // X軸とY軸を拡大・縮小させる
            mat4.scale(transformMatrix, transformMatrix, [triangleScale, triangleScale, 1]);

            // --- 描画処理 ---
            gl.useProgram(shaderProgram);

            // 3. 計算した行列をシェーダーに送信
            gl.uniformMatrix4fv(uTransformMatrixLocation, false, transformMatrix);

            // 4. 頂点データをシェーダーに送信
            const vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(vertexPosition);

            // 5. 描画命令
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        // 次のフレームを要求
        requestAnimationFrame(render);
    }

    // --- イベントリスナーの設定 ---
    scaleSlider.addEventListener('input', e => { 
        triangleScale = parseFloat(e.target.value); 
    });
    rotationSlider.addEventListener('input', e => { 
        triangleRotationSpeed = parseFloat(e.target.value); 
    });
    updateBtn.addEventListener('click', compileShaders);
    resetBtn.addEventListener('click', () => {
        vsEditor.value = initialVsCode;
        fsEditor.value = initialFsCode;
        compileShaders();
    });

    // --- 初期化処理の実行 ---
    initBuffers();
    compileShaders();
    requestAnimationFrame(render); // アニメーションループを開始
}

/**
 * webgl-demo.jsのコードをページに表示する
 */
function displayWebGLDemoCode() {
    const codeDisplay = document.getElementById('webgl-demo-code-display');
    if (codeDisplay) {
        codeDisplay.textContent = webglDemoCodeString.trim();
    }
}