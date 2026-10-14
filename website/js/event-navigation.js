document.querySelector('nav a[href="#event"]').addEventListener("click", (event) => {
    event.preventDefault();
    const details = document.getElementById("event");
    const top = window.scrollY + details.getBoundingClientRect().top - 24;
    history.replaceState(null, "", "#event");
    window.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});
