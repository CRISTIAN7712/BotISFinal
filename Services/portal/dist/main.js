document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.querySelector('.menu-toggle');
    const navMobile = document.querySelector('.nav-mobile');

    menuToggle.addEventListener('click', function () {
        navMobile.classList.toggle('show');
    });

    const pdfButton = document.getElementById('pdfButton');
    pdfButton.addEventListener('click', function () {
        window.open('documentacion.pdf', '_blank');
    });

    const volverInicioButton = document.getElementById('volverInicio');
    volverInicioButton.addEventListener('click', function () {
        window.location.href = 'index.html';
    });
});
