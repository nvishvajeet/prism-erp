class Prism < Formula
  desc "Open-source ERP for research facilities"
  homepage "https://github.com/YOUR-ORG/prism-erp"
  url "https://github.com/YOUR-ORG/prism-erp/archive/refs/tags/prism-v1.tar.gz"
  version "1.0"
  license "MIT"

  depends_on "python@3.9"

  def install
    # Install the entire app into the Cellar
    libexec.install Dir["*"]

    # Create venv and install deps
    system "python3", "-m", "venv", libexec/"venv"
    system libexec/"venv/bin/pip", "install", "-q", "-r", libexec/"requirements.txt"

    # Create wrapper scripts in bin/
    (bin/"prism").write <<~EOS
      #!/bin/bash
      export PRISM_HOME="#{libexec}"
      cd "#{libexec}"
      exec ./venv/bin/python -c "import app; app.app.run(host='0.0.0.0', port=5055)" "$@"
    EOS

    (bin/"prism-init").write <<~EOS
      #!/bin/bash
      export PRISM_HOME="#{libexec}"
      cd "#{libexec}"
      mkdir -p data/demo data/operational logs
      [ -f .env ] || cat > .env << ENV
LAB_SCHEDULER_SECRET_KEY=$(./venv/bin/python -c "import secrets; print(secrets.token_hex(32))")
LAB_SCHEDULER_DEMO_MODE=1
LAB_SCHEDULER_CSRF=1
OWNER_EMAILS=admin@lab.local
ENV
      ./venv/bin/python -c "import app; app.init_db()"
      echo "PRISM initialized. Run 'prism' to start."
    EOS

    (bin/"prism-test").write <<~EOS
      #!/bin/bash
      cd "#{libexec}"
      exec ./venv/bin/python scripts/smoke_test.py "$@"
    EOS
  end

  def post_install
    system bin/"prism-init"
  end

  def caveats
    <<~EOS
      PRISM ERP installed.

      First run:
        prism-init      # Initialize database
        prism           # Start server on http://localhost:5055

      Login:
        Email:    owner@prism.local
        Password: 12345

      Configure:
        #{libexec}/.env

      Test:
        prism-test
    EOS
  end

  test do
    system bin/"prism-test"
  end
end
