
<style>{`
  .fees-module,
  .fees-module * {
    box-sizing: border-box;
  }

  .fees-module {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
  }

  .fees-module section {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .fees-module input,
  .fees-module select,
  .fees-module textarea,
  .fees-module button {
    max-width: 100%;
    min-width: 0;
  }

  .fees-module .fees-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
  }

  .fees-module .table-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 700px) {
    .fees-module .fees-form {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .fees-module .fees-form > * {
      width: 100%;
      min-width: 0;
    }

    .fees-module section {
      padding-left: 14px !important;
      padding-right: 14px !important;
    }
  }
`}</style>
