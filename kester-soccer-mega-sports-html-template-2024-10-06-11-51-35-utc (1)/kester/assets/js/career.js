document.addEventListener("DOMContentLoaded", function () {
    const joinUsButton = document.querySelector("a[href='#job-openings']"); // Select the "Join Us" button
    const targetSection = document.querySelector("#job-openings"); // Select the "Current Job Openings" section

    if (joinUsButton && targetSection) {
        joinUsButton.addEventListener("click", function (event) {
            event.preventDefault(); // Prevent default anchor behavior

            // Calculate the offset position, accounting for the menu height
            const menuHeight = document.querySelector("header").offsetHeight; // Adjust this selector if needed
            const targetPosition = targetSection.offsetTop - menuHeight + 570; // Add extra spacing if needed

            // Smooth scroll to the target position
            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });
        });
    }
});