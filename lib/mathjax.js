(function () {
    const run = () => {
        if (window.MathJax?.startup) {
            try {
                MathJax.startup.document.getMathItemsWithin(document.body)
                    .forEach(item => item.typesetRoot?.setAttribute('data-formula', item.math));
            } catch (e) {
                console.error('Error processing MathJax3 items:', e);
            }
        } else if (window.MathJax?.Hub) {
            try {
                window.MathJax.Hub.getAllJax()
                    .forEach(math => {
                        const originalTex = math.originalText;
                        const scriptTag = math.SourceElement();
                        const displayElement = scriptTag ? scriptTag.previousSibling : null;

                        if (displayElement && displayElement.setAttribute) {
                            displayElement.setAttribute('data-formula', originalTex);
                        }
                    });
            } catch (e) {
                console.error('Error processing MathJax2 items:', e);
            }
        } else {
            setTimeout(run, 1000);
        }
    };

    run();
})();