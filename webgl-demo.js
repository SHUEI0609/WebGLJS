// webgl-demo.js

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

    rotationSlider.addEventListener('input', e => { rotationSpeed = parseFloat(e.target.value); });
    zoomSlider.addEventListener('input', e => { cameraDistance = parseFloat(e.target.value); });
    colorPicker.addEventListener('input', e => {
        const hex = e.target.value;
        catColor = [
            parseInt(hex.substring(1, 3), 16) / 255,
            parseInt(hex.substring(3, 5), 16) / 255,
            parseInt(hex.substring(5, 7), 16) / 255,
            1.0
        ];
    });

    const vsSource = `
        attribute vec3 aVertexPosition;
        uniform mat4 uMvpMatrix;
        void main(void) {
            gl_Position = uMvpMatrix * vec4(aVertexPosition, 1.0);
        }
    `;

    const fsSource = `
        precision mediump float;
        uniform vec4 uColor;
        void main(void) {
            gl_FragColor = uColor;
        }
    `;
    
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